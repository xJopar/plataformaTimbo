import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { resolveGoogleOAuthConfig } from '../../runtime-config';
import { AuthPublicError } from './auth-public.errors';

export interface GoogleIdentity {
  subject: string;
  email: string;
  displayName?: string;
}

export interface CreateGoogleAuthorizationUrlInput {
  state: string;
  codeChallenge: string;
}

export interface ExchangeGoogleAuthorizationCodeInput {
  code: string;
  pkceVerifier: string;
}

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = ['openid', 'email', 'profile'] as const;

@Injectable()
export class GoogleOAuthService {
  public createAuthorizationUrl(input: CreateGoogleAuthorizationUrlInput): string {
    const config = resolveGoogleOAuthConfig();
    const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    authorizationUrl.searchParams.set('state', input.state);
    authorizationUrl.searchParams.set('code_challenge', input.codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    return authorizationUrl.toString();
  }

  public async exchangeAuthorizationCode(
    input: ExchangeGoogleAuthorizationCodeInput,
  ): Promise<GoogleIdentity> {
    const config = resolveGoogleOAuthConfig();
    const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
    let tokenResponse;
    try {
      tokenResponse = await client.getToken({
        code: input.code,
        codeVerifier: input.pkceVerifier,
      });
    } catch (error) {
      if (isExpectedGoogleProviderFailure(error)) {
        throw new AuthPublicError('GOOGLE_IDENTITY_INVALID', 401);
      }
      throw error;
    }
    const idToken = tokenResponse.tokens.id_token;

    if (typeof idToken !== 'string') {
      throw new AuthPublicError('GOOGLE_IDENTITY_INVALID', 401);
    }

    let ticket;
    try {
      ticket = await client.verifyIdToken({ idToken, audience: config.clientId });
    } catch (error) {
      if (isExpectedGoogleProviderFailure(error) || isExpectedIdTokenVerificationFailure(error)) {
        throw new AuthPublicError('GOOGLE_IDENTITY_INVALID', 401);
      }
      throw error;
    }
    const payload = ticket.getPayload();
    const email = payload?.email;
    const subject = payload?.sub;

    if (
      payload?.email_verified !== true ||
      typeof email !== 'string' ||
      email.trim().length === 0 ||
      typeof subject !== 'string' ||
      subject.length === 0
    ) {
      throw new AuthPublicError('GOOGLE_IDENTITY_INVALID', 401);
    }

    return {
      subject,
      email,
      ...(typeof payload.name === 'string' ? { displayName: payload.name } : {}),
    };
  }
}

function isExpectedGoogleProviderFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return false;
  }

  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) {
    return false;
  }

  return response.status === 400 || response.status === 401;
}

// google-auth-library@11.0.2 (oauth2client.js, verifySignedJwtWithCertsAsync) no expone clases ni
// códigos estables para rechazos locales de verificación del ID token: lanza `Error` planos con
// estos prefijos de mensaje literales para firma, issuer, audience y ventana temporal (early/late).
// Es el criterio más estrecho disponible en esta versión; otros mensajes de la misma función
// (token malformado, certificado ausente, etc.) quedan deliberadamente fuera y siguen fail-fast.
// Si se actualiza la dependencia, revisar que estos mensajes sigan vigentes.
const EXPECTED_ID_TOKEN_VERIFICATION_MESSAGE_PREFIXES = [
  'Invalid token signature: ',
  'Invalid issuer, expected one of [',
  'Wrong recipient, payload audience != requiredAudience',
  'Token used too early, ',
  'Token used too late, ',
] as const;

function isExpectedIdTokenVerificationFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return EXPECTED_ID_TOKEN_VERIFICATION_MESSAGE_PREFIXES.some((prefix) =>
    error.message.startsWith(prefix),
  );
}
