import { Injectable, Logger } from '@nestjs/common';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { resolveVehicleImagesConfig } from './vehicle-images.config';
import vehicleImageFolders from './vehicle-image-folders.json';
import type { VehicleResponseDto } from './dto/vehicle-response.dto';

const STOCK_TO_PREFIX: Record<string, string> = vehicleImageFolders;

/** Cuánto se cachea en memoria el listado completo del bucket antes de refrescarlo. */
const LISTING_CACHE_MILLISECONDS = 5 * 60 * 1000;
/** Vigencia de cada URL presignada; se regeneran en cada `attachImages`, no hace falta más. */
const PRESIGNED_URL_EXPIRY_SECONDS = 60 * 60;

interface ListingCache {
  fetchedAt: number;
  keys: string[];
}

/**
 * Sirve las fotos organizadas en el bucket S3-compatible de Railway para Lista de Precios.
 *
 * El mapeo Stock -> carpeta (`vehicle-image-folders.json`) es un manifiesto generado a mano
 * (ver `scripts/lista-precios-imagenes/build-image-manifest.py`) porque el árbol de carpetas del
 * bucket fue reorganizado manualmente y ya no es 100% derivable por fórmula desde
 * Marca/Modelo/Config/Susp. El listado de archivos DENTRO de cada carpeta sí se lee en vivo del
 * bucket (no del manifiesto), así que agregar/sacar fotos de una carpeta ya existente no
 * requiere regenerar nada.
 *
 * El bucket es privado: se sirven URLs presignadas (GET, expiran) en vez de proxear los bytes
 * por la propia API, porque el egress directo del bucket es gratis en Railway y el de la API no.
 */
@Injectable()
export class VehicleImagesService {
  private readonly logger = new Logger(VehicleImagesService.name);
  private client: S3Client | undefined;
  private listingCache: ListingCache | undefined;
  private listingPromise: Promise<string[]> | undefined;

  public async attachImages(rows: VehicleResponseDto[]): Promise<VehicleResponseDto[]> {
    const stocksWithFolder = rows
      .map((row) => row.stock)
      .filter((stock) => STOCK_TO_PREFIX[stock] !== undefined);

    if (stocksWithFolder.length === 0) {
      return rows;
    }

    let keys: string[];
    try {
      keys = await this.getKeys();
    } catch (error) {
      this.logger.warn('No se pudo listar el bucket de imágenes; se muestran sin fotos.', error);
      return rows;
    }

    return Promise.all(
      rows.map(async (row) => {
        const prefix = STOCK_TO_PREFIX[row.stock];
        if (prefix === undefined) {
          return row;
        }
        const images = await this.resolveImageUrls(keys, prefix);
        return images.length > 0 ? Object.assign(row, { images }) : row;
      }),
    );
  }

  private async resolveImageUrls(keys: string[], prefix: string): Promise<string[]> {
    const folderPrefix = `${prefix}/`;
    const matchingKeys = keys
      .filter((key) => key.startsWith(folderPrefix) && !key.slice(folderPrefix.length).includes('/'))
      .sort((a, b) => extractOrder(a) - extractOrder(b));

    return Promise.all(matchingKeys.map((key) => this.presign(key)));
  }

  private presign(key: string): Promise<string> {
    const config = resolveVehicleImagesConfig();
    const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
    return getSignedUrl(this.getClient(config), command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });
  }

  private async getKeys(): Promise<string[]> {
    const now = Date.now();
    if (this.listingCache && now - this.listingCache.fetchedAt < LISTING_CACHE_MILLISECONDS) {
      return this.listingCache.keys;
    }
    this.listingPromise ??= this.listAllKeys().finally(() => {
      this.listingPromise = undefined;
    });
    const keys = await this.listingPromise;
    this.listingCache = { fetchedAt: now, keys };
    return keys;
  }

  private async listAllKeys(): Promise<string[]> {
    const config = resolveVehicleImagesConfig();
    const client = this.getClient(config);
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await client.send(
        new ListObjectsV2Command({ Bucket: config.bucket, ContinuationToken: continuationToken }),
      );
      for (const object of response.Contents ?? []) {
        if (object.Key !== undefined) keys.push(object.Key);
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);
    return keys;
  }

  private getClient(config: ReturnType<typeof resolveVehicleImagesConfig>): S3Client {
    this.client ??= new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    return this.client;
  }
}

/** "12.webp" -> 12; nombres sin número numérico al frente van al final. */
function extractOrder(key: string): number {
  const filename = key.split('/').pop() ?? key;
  const match = /^(\d+)/.exec(filename);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}
