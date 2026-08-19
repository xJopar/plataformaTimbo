import { OAuth2Client } from 'google-auth-library';
import { AuthPublicError } from './auth-public.errors';
import { GoogleOAuthService } from './google-oauth.service';

describe('GoogleOAuthService', () => {
  const originalEnvironment = {
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  };

  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
  });

  it('traduce un rechazo esperado del proveedor a un código público seguro', async () => {
    const getTokenMock = jest.spyOn(OAuth2Client.prototype, 'getToken') as unknown as {
      mockRejectedValue(value: unknown): void;
    };
    getTokenMock.mockRejectedValue({ response: { status: 400 } });

    let caughtError: unknown;
    try {
      await new GoogleOAuthService().exchangeAuthorizationCode({
        code: 'authorization-code',
        pkceVerifier: 'verifier',
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(AuthPublicError);
    if (!(caughtError instanceof AuthPublicError)) {
      throw new Error('Se esperaba un AuthPublicError.');
    }
    expect(caughtError.code).toBe('GOOGLE_IDENTITY_INVALID');
  });

  it('preserva un fallo inesperado del proveedor para diagnóstico fail-fast', async () => {
    const providerFailure = new Error('provider unavailable');
    const getTokenMock = jest.spyOn(OAuth2Client.prototype, 'getToken') as unknown as {
      mockRejectedValue(value: unknown): void;
    };
    getTokenMock.mockRejectedValue(providerFailure);

    await expect(
      new GoogleOAuthService().exchangeAuthorizationCode({
        code: 'authorization-code',
        pkceVerifier: 'verifier',
      }),
    ).rejects.toBe(providerFailure);
  });

  describe('rechazos locales de verifyIdToken', () => {
    const mockSuccessfulTokenExchange = (): void => {
      const getTokenMock = jest.spyOn(OAuth2Client.prototype, 'getToken') as unknown as {
        mockResolvedValue(value: unknown): void;
      };
      getTokenMock.mockResolvedValue({ tokens: { id_token: 'opaque-id-token' } });
    };

    const mockVerifyIdTokenRejection = (rejection: Error): void => {
      const verifyIdTokenMock = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken') as unknown as {
        mockRejectedValue(value: unknown): void;
      };
      verifyIdTokenMock.mockRejectedValue(rejection);
    };

    it.each([
      ['firma inválida', new Error('Invalid token signature: opaque-id-token')],
      [
        'issuer inválido',
        new Error(
          'Invalid issuer, expected one of [accounts.google.com, https://accounts.google.com], but got https://evil.example.test',
        ),
      ],
      ['audience inválida', new Error('Wrong recipient, payload audience != requiredAudience')],
      ['token usado demasiado temprano', new Error('Token used too early, 100 < 200: {}')],
      ['token usado demasiado tarde', new Error('Token used too late, 500 > 200: {}')],
    ])('traduce un rechazo de %s a un código público seguro', async (_description, rejection) => {
      mockSuccessfulTokenExchange();
      mockVerifyIdTokenRejection(rejection);

      let caughtError: unknown;
      try {
        await new GoogleOAuthService().exchangeAuthorizationCode({
          code: 'authorization-code',
          pkceVerifier: 'verifier',
        });
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(AuthPublicError);
      if (!(caughtError instanceof AuthPublicError)) {
        throw new Error('Se esperaba un AuthPublicError.');
      }
      expect(caughtError.code).toBe('GOOGLE_IDENTITY_INVALID');
      expect(caughtError.message).not.toContain(rejection.message);
    });

    it('preserva un rechazo local no documentado (fuera de firma/issuer/audience/tiempo) para diagnóstico fail-fast', async () => {
      mockSuccessfulTokenExchange();
      const undocumentedRejection = new Error('No pem found for envelope: {"kid":"unknown"}');
      mockVerifyIdTokenRejection(undocumentedRejection);

      await expect(
        new GoogleOAuthService().exchangeAuthorizationCode({
          code: 'authorization-code',
          pkceVerifier: 'verifier',
        }),
      ).rejects.toBe(undocumentedRejection);
    });

    it('preserva un fallo inesperado y genérico de verifyIdToken para diagnóstico fail-fast', async () => {
      mockSuccessfulTokenExchange();
      const unexpectedFailure = new Error('network timeout while fetching certs');
      mockVerifyIdTokenRejection(unexpectedFailure);

      await expect(
        new GoogleOAuthService().exchangeAuthorizationCode({
          code: 'authorization-code',
          pkceVerifier: 'verifier',
        }),
      ).rejects.toBe(unexpectedFailure);
    });
  });
});
