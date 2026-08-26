import { Inject, Injectable } from '@nestjs/common';
import { resolveZohoAnalyticsConfig, type ZohoAnalyticsConfig } from './lista-precios.config';
import { ListaPreciosProviderUnavailableError } from './lista-precios.errors';
import { LISTA_PRECIOS_FETCH } from './lista-precios.tokens';

const ZOHO_OAUTH_TOKEN_ENDPOINT = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_ANALYTICS_API_BASE = 'https://analyticsapi.zoho.com';
const PROVIDER_TIMEOUT_MILLISECONDS = 15_000;

type FetchImplementation = typeof fetch;

/** Fila cruda de la vista de Zoho Analytics: nombres de columna ya normalizados. */
export type ZohoVehicleRow = Record<string, string>;

const COLUMN_NAME_MAP: Record<string, string> = {
  'Aprox. Llegada': 'aproxLlegada',
  Disponible1: 'disponible1',
  Stock: 'stock',
  Marca: 'marca',
  Modelo: 'modelo',
  'Año Fab.': 'anioFab',
  'Config.': 'config',
  'Susp.': 'susp',
  'Tipo Motor': 'tipoMotor',
  'Tipo Cabina': 'tipoCabina',
  'Tipo Caja': 'tipoCaja',
  Aire: 'aire',
  Color: 'color',
  KM: 'km',
  'Precio Lista': 'precioLista',
  Ubicacion: 'ubicacion',
  'Fecha de Seña': 'fechaSena',
  'Vendedor Seña': 'vendedorSena',
  U_comentario: 'uComentario',
  Disponible: 'disponible',
  'Tipo Unidad': 'tipoUnidad',
  Uso: 'uso',
  Inyeccion: 'inyeccion',
  Altura: 'altura',
  Piso: 'piso',
  Tipo: 'tipo',
  Chasis: 'chasis',
  URL: 'url',
  CodGrupoUnidad: 'codGrupo',
  Comentario: 'comentario',
  Origen: 'origen',
  kilometrajeOrigen: 'kmOrigen',
  FechaEntradaTaller: 'fechaEntradaTaller',
  FechaEstimadaSalidaTaller: 'fechaSalidaTaller',
  Equipamiento: 'equipamiento',
  Laterales: 'laterales',
  'Dias Transcurridos': 'diasTranscurridos',
  Ubicacion1: 'ubicacion1',
};

/**
 * Parsea CSV (RFC 4180): campos entre comillas, comas dentro de comillas, CRLF y LF.
 * Zoho Analytics devuelve la vista como `text/csv`, no como JSON.
 */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

function parseCsv(text: string): string[][] {
  const withoutBom = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < withoutBom.length; i++) {
    const char = withoutBom[i];
    const next = withoutBom[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      row.push(field);
      field = '';
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      if (char === '\r' && next === '\n') {
        i++;
      }
    } else {
      field += char ?? '';
    }
  }

  row.push(field);
  if (row.some((value) => value !== '')) {
    rows.push(row);
  }

  return rows;
}

function toVehicleRows(csvText: string): ZohoVehicleRow[] {
  const allRows = parseCsv(csvText);
  if (allRows.length < 2) {
    return [];
  }

  const headerRow = allRows[0];
  if (headerRow === undefined) {
    return [];
  }
  const dataRows = allRows.slice(1);
  const headers = headerRow.map((column) => COLUMN_NAME_MAP[column] ?? column);

  return dataRows.map((row) => {
    const vehicleRow: ZohoVehicleRow = {};
    headers.forEach((header, index) => {
      vehicleRow[header] = (row[index] ?? '').trim();
    });
    return vehicleRow;
  });
}

@Injectable()
export class ListaPreciosService {
  private accessToken = '';
  private refreshPromise: Promise<void> | undefined;

  public constructor(
    @Inject(LISTA_PRECIOS_FETCH) private readonly fetchImplementation: FetchImplementation,
  ) {}

  public async getVehicles(): Promise<ZohoVehicleRow[]> {
    const config = resolveZohoAnalyticsConfig();

    if (this.accessToken === '') {
      await this.refreshAccessToken(config);
    }

    let response = await this.fetchVehiclesView(config);
    if (response.status === 401) {
      await this.refreshAccessToken(config);
      response = await this.fetchVehiclesView(config);
    }

    const csvText = await response.text();
    if (!response.ok) {
      throw new ListaPreciosProviderUnavailableError(
        `Zoho Analytics respondió con estado HTTP ${String(response.status)}.`,
      );
    }

    return toVehicleRows(csvText);
  }

  private async fetchVehiclesView(config: ZohoAnalyticsConfig): Promise<Response> {
    const url = `${ZOHO_ANALYTICS_API_BASE}/restapi/v2/workspaces/${config.workspaceId}/views/${config.viewId}/data`;
    try {
      return await this.fetchImplementation(url, {
        headers: {
          Authorization: `Zoho-oauthtoken ${this.accessToken}`,
          'ZANALYTICS-ORGID': config.orgId,
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw new ListaPreciosProviderUnavailableError(
        'No fue posible conectar con Zoho Analytics.',
        { cause: error },
      );
    }
  }

  /**
   * Refresca el access token en memoria del proceso (no por usuario): un único refresh
   * token de Self Client sirve a todas las sesiones, así que compartirlo entre requests
   * reduce llamadas a Zoho en vez de que cada usuario dispare su propio refresh.
   * `refreshPromise` evita refrescos simultáneos cuando varias requests llegan sin token.
   */
  private async refreshAccessToken(config: ZohoAnalyticsConfig): Promise<void> {
    if (this.refreshPromise !== undefined) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.exchangeRefreshToken(config).finally(() => {
      this.refreshPromise = undefined;
    });

    return this.refreshPromise;
  }

  private async exchangeRefreshToken(config: ZohoAnalyticsConfig): Promise<void> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    });

    let response: Response;
    try {
      response = await this.fetchImplementation(ZOHO_OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw new ListaPreciosProviderUnavailableError(
        'No fue posible conectar con el endpoint OAuth de Zoho.',
        { cause: error },
      );
    }

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new ListaPreciosProviderUnavailableError(
        'Zoho respondió con un formato inesperado al refrescar el token.',
        { cause: error },
      );
    }

    const accessToken = isRecord(json) ? json.access_token : undefined;
    if (typeof accessToken !== 'string' || accessToken.trim() === '') {
      throw new ListaPreciosProviderUnavailableError(
        'Zoho no devolvió un access_token válido al refrescar el token.',
      );
    }

    this.accessToken = accessToken;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
