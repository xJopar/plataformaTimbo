import { Inject, Injectable } from '@nestjs/common';
import {
  resolveMetaCompanyServiceLayerConfig,
  type MetaCompanyServiceLayerConfig,
} from './meta-company-service-layer.config';
import { MetaCompanyServiceLayerUnavailableError } from './meta-company-service-layer.errors';
import { META_COMPANY_SERVICE_LAYER_FETCH } from './meta-company-service-layer.tokens';

const PROVIDER_TIMEOUT_MILLISECONDS = 15_000;
const TOKEN_EXPIRATION_SAFETY_MILLISECONDS = 60_000;

type FetchImplementation = typeof fetch;

interface ServiceLayerSession {
  token: string;
  tokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
}

class ServiceLayerRefreshRejectedError extends Error {
  public constructor() {
    super('Service Layer rechazo el refresh token.');
    this.name = 'ServiceLayerRefreshRejectedError';
  }
}

@Injectable()
export class MetaCompanyServiceLayerService {
  private session: ServiceLayerSession | undefined;
  private authenticationPromise: Promise<void> | undefined;

  public constructor(
    @Inject(META_COMPANY_SERVICE_LAYER_FETCH)
    private readonly fetchImplementation: FetchImplementation,
  ) {}

  public async verifySapAdvisor(salespersonCode: number): Promise<boolean> {
    let response = await this.fetchSapVerification(salespersonCode);

    if (response.status === 401) {
      this.invalidateAccessToken();
      response = await this.fetchSapVerification(salespersonCode);
    }

    if (!response.ok) {
      throw new MetaCompanyServiceLayerUnavailableError(
        `Service Layer respondio con estado HTTP ${String(response.status)} al verificar el asesor SAP.`,
      );
    }

    const body = await parseJsonResponse(response, 'verificar el asesor SAP');
    const data = isRecord(body) ? body.data : undefined;
    const exists = isRecord(data) ? data.existe : undefined;

    if (typeof exists !== 'boolean') {
      throw new MetaCompanyServiceLayerUnavailableError(
        'Service Layer devolvio una respuesta invalida al verificar el asesor SAP.',
      );
    }

    return exists;
  }

  private async fetchSapVerification(salespersonCode: number): Promise<Response> {
    const config = resolveMetaCompanyServiceLayerConfig();
    const token = await this.getAccessToken(config);

    try {
      return await this.fetchImplementation(`${config.baseUrl}/asesores/verificar-sap`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ SlpCode: salespersonCode }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw new MetaCompanyServiceLayerUnavailableError(
        'No fue posible conectar con Service Layer para verificar el asesor SAP.',
        error,
      );
    }
  }

  private async getAccessToken(config: MetaCompanyServiceLayerConfig): Promise<string> {
    const currentSession = this.session;
    if (this.hasValidAccessToken() && currentSession !== undefined) {
      return currentSession.token;
    }

    if (this.authenticationPromise !== undefined) {
      await this.authenticationPromise;
      if (this.session === undefined) {
        throw new MetaCompanyServiceLayerUnavailableError(
          'Service Layer no devolvio una sesion valida.',
        );
      }
      return this.session.token;
    }

    this.authenticationPromise = this.authenticate(config).finally(() => {
      this.authenticationPromise = undefined;
    });
    await this.authenticationPromise;

    if (this.session === undefined) {
      throw new MetaCompanyServiceLayerUnavailableError(
        'Service Layer no devolvio una sesion valida.',
      );
    }

    return this.session.token;
  }

  private async authenticate(config: MetaCompanyServiceLayerConfig): Promise<void> {
    const currentSession = this.session;
    if (this.hasValidRefreshToken() && currentSession !== undefined) {
      try {
        this.session = await this.refreshSession(config, currentSession.refreshToken);
        return;
      } catch (error) {
        if (!(error instanceof ServiceLayerRefreshRejectedError)) {
          throw error;
        }
        this.session = undefined;
      }
    }

    this.session = await this.login(config);
  }

  private async login(config: MetaCompanyServiceLayerConfig): Promise<ServiceLayerSession> {
    const response = await this.fetchAuthenticationEndpoint(
      `${config.baseUrl}/auth/login`,
      { username: config.username, password: config.password, domain: config.domain },
      'iniciar sesion',
    );
    return parseSession(response, 'iniciar sesion');
  }

  private async refreshSession(
    config: MetaCompanyServiceLayerConfig,
    refreshToken: string,
  ): Promise<ServiceLayerSession> {
    let response: Response;
    try {
      response = await this.fetchImplementation(
        `${config.baseUrl}/auth/refresh?${new URLSearchParams({ refreshToken }).toString()}`,
        { signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS) },
      );
    } catch (error) {
      throw new MetaCompanyServiceLayerUnavailableError(
        'No fue posible conectar con Service Layer para renovar la sesion.',
        error,
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new ServiceLayerRefreshRejectedError();
    }
    if (!response.ok) {
      throw new MetaCompanyServiceLayerUnavailableError(
        `Service Layer respondio con estado HTTP ${String(response.status)} al renovar la sesion.`,
      );
    }

    return parseSession(response, 'renovar la sesion');
  }

  private async fetchAuthenticationEndpoint(
    url: string,
    body: Record<string, string>,
    operation: string,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw new MetaCompanyServiceLayerUnavailableError(
        `No fue posible conectar con Service Layer para ${operation}.`,
        error,
      );
    }

    if (!response.ok) {
      throw new MetaCompanyServiceLayerUnavailableError(
        `Service Layer respondio con estado HTTP ${String(response.status)} al ${operation}.`,
      );
    }

    return response;
  }

  private hasValidAccessToken(): boolean {
    return this.session !== undefined && Date.now() < this.session.tokenExpiresAt;
  }

  private hasValidRefreshToken(): boolean {
    return this.session !== undefined && Date.now() < this.session.refreshTokenExpiresAt;
  }

  private invalidateAccessToken(): void {
    if (this.session !== undefined) {
      this.session.tokenExpiresAt = 0;
    }
  }
}

async function parseSession(response: Response, operation: string): Promise<ServiceLayerSession> {
  const body = await parseJsonResponse(response, operation);
  const data = isRecord(body) ? body.data : undefined;
  const token = isRecord(data) ? data.token : undefined;
  const expiresIn = isRecord(data) ? data.expiresIn : undefined;
  const refreshToken = isRecord(data) ? data.refreshToken : undefined;
  const refreshTokenExpiresIn = isRecord(data) ? data.refreshTokenExpiresIn : undefined;

  if (
    typeof token !== 'string' ||
    token.trim() === '' ||
    !isPositiveFiniteNumber(expiresIn) ||
    typeof refreshToken !== 'string' ||
    refreshToken.trim() === '' ||
    !isPositiveFiniteNumber(refreshTokenExpiresIn)
  ) {
    throw new MetaCompanyServiceLayerUnavailableError(
      `Service Layer devolvio una sesion invalida al ${operation}.`,
    );
  }

  return {
    token,
    tokenExpiresAt: expirationTimestamp(expiresIn),
    refreshToken,
    refreshTokenExpiresAt: expirationTimestamp(refreshTokenExpiresIn),
  };
}

async function parseJsonResponse(response: Response, operation: string): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new MetaCompanyServiceLayerUnavailableError(
      `Service Layer devolvio un formato invalido al ${operation}.`,
      error,
    );
  }
}

function expirationTimestamp(expiresInSeconds: number): number {
  const lifetimeMilliseconds = expiresInSeconds * 1_000;
  return Date.now() + Math.max(0, lifetimeMilliseconds - TOKEN_EXPIRATION_SAFETY_MILLISECONDS);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
