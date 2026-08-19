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
    const tokenResponse = await client.getToken({
      code: input.code,
      codeVerifier: input.pkceVerifier,
    });
    const idToken = tokenResponse.tokens.id_token;

    if (typeof idToken !== 'string') {
      throw new AuthPublicError('GOOGLE_IDENTITY_INVALID', 401);
    }

    const ticket = await client.verifyIdToken({ idToken, audience: config.clientId });
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
