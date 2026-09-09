import type { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { resolveVehicleImagesConfig } from './vehicle-images.config';
import vehicleImageFolders from './vehicle-image-folders.json';
import type { VehicleImageDto } from './dto/vehicle-response.dto';

const THUMB_DIR_NAME = 'thumbs';

const STOCK_TO_PREFIX: Record<string, string> = vehicleImageFolders;

/** Cuánto se cachea en memoria el listado completo del bucket antes de refrescarlo. */
const LISTING_CACHE_MILLISECONDS = 5 * 60 * 1000;

interface ListingCache {
  fetchedAt: number;
  keys: string[];
}

export interface StreamedImage {
  body: Readable;
  contentType: string;
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
 * El bucket es privado y la API lo lee con sus propias credenciales (no hace falta presignar
 * nada): `getImages` sólo devuelve las *keys* de S3 de cada foto, y el navegador las pide por
 * `streamImage` a través de una URL propia y estable (misma key siempre = cacheable de verdad,
 * a diferencia de una URL presignada que cambia de firma en cada pedido).
 */
@Injectable()
export class VehicleImagesService {
  private readonly logger = new Logger(VehicleImagesService.name);
  private client: S3Client | undefined;
  private listingCache: ListingCache | undefined;
  private listingPromise: Promise<string[]> | undefined;

  /** Devuelve las keys de S3 (foto completa + miniatura) de un Stock, en orden, o [] si no hay. */
  public async getImages(stock: string): Promise<VehicleImageDto[]> {
    const prefix = STOCK_TO_PREFIX[stock];
    if (prefix === undefined) {
      return [];
    }

    let keys: string[];
    try {
      keys = await this.getKeys();
    } catch (error) {
      this.logger.warn('No se pudo listar el bucket de imágenes; se muestran sin fotos.', error);
      return [];
    }

    const folderPrefix = `${prefix}/`;
    const keySet = new Set(keys);
    return keys
      .filter((key) => key.startsWith(folderPrefix) && !key.slice(folderPrefix.length).includes('/'))
      .sort((a, b) => extractOrder(a) - extractOrder(b))
      .map((key) => {
        const thumbKey = toThumbKey(key);
        return { full: key, thumb: keySet.has(thumbKey) ? thumbKey : key };
      });
  }

  /**
   * Trae el contenido de una key del bucket para transmitirlo al navegador. Sólo sirve keys que
   * figuran en el listado en vivo del bucket (nunca una key arbitraria del pedido), así que el
   * endpoint que expone esto no puede usarse para curiosear el bucket más allá de lo que
   * `getImages` ya expone igual.
   */
  public async streamImage(key: string): Promise<StreamedImage | null> {
    let keys: string[];
    try {
      keys = await this.getKeys();
    } catch (error) {
      this.logger.warn('No se pudo listar el bucket de imágenes.', error);
      return null;
    }
    if (!keys.includes(key)) {
      return null;
    }

    const config = resolveVehicleImagesConfig();
    const response = await this.getClient(config).send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    if (response.Body === undefined) {
      return null;
    }
    return {
      body: response.Body as Readable,
      contentType: response.ContentType ?? 'application/octet-stream',
    };
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

/**
 * "MARCA/MODELO/STOCK/2.jpg" -> "MARCA/MODELO/STOCK/thumbs/2.webp": la miniatura vive al lado
 * del original, siempre en WebP (ver `scripts/lista-precios-imagenes/generate-thumbnails.mjs`).
 */
function toThumbKey(key: string): string {
  const lastSlash = key.lastIndexOf('/');
  const dir = key.slice(0, lastSlash);
  const filename = key.slice(lastSlash + 1);
  const base = filename.replace(/\.[^.]+$/, '');
  return `${dir}/${THUMB_DIR_NAME}/${base}.webp`;
}
