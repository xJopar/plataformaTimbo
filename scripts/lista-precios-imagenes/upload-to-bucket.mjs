import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

/**
 * Fase C del plan de imágenes de Lista de Precios: sube el árbol ya organizado y renombrado en
 * `imagenes_lista_precios/` a un bucket S3-compatible de Railway. Los buckets S3 no tienen
 * carpetas reales — la key del objeto (ej. "SCANIA/R/C18571/1.webp") arma la jerarquía sola, no
 * hace falta crearlas a mano.
 *
 * Uso:
 *   node --env-file=.env scripts/lista-precios-imagenes/upload-to-bucket.mjs [carpetaOrigen]
 *
 * Variables de entorno requeridas (ver .env.example): BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY,
 * ENDPOINT, REGION.
 */

const SOURCE_DIR =
  process.argv[2] ?? 'C:\\Users\\desarrollo4.ti\\Downloads\\imagenes_lista_precios';

const CONCURRENCY = 6;
const IMAGE_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']);
const CONTENT_TYPE_BY_EXT = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Copiá .env.example a .env y completala.`);
  }
  return value;
}

const BUCKET = requireEnv('BUCKET');
const client = new S3Client({
  region: process.env.REGION || 'auto',
  endpoint: requireEnv('ENDPOINT'),
  credentials: {
    accessKeyId: requireEnv('ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('SECRET_ACCESS_KEY'),
  },
});

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function toObjectKey(filePath) {
  return relative(SOURCE_DIR, filePath).split('\\').join('/');
}

/** Trae las keys ya existentes en el bucket, para no re-subir lo que ya está (reanudable). */
async function listExistingKeys() {
  const keys = new Set();
  let continuationToken;
  do {
    const response = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: continuationToken }),
    );
    for (const object of response.Contents ?? []) {
      if (object.Key) keys.add(object.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function runWithConcurrency(items, limit, worker) {
  let nextIndex = 0;
  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
}

async function main() {
  console.log(`Origen: ${SOURCE_DIR}`);
  console.log(`Bucket: ${BUCKET}`);

  const allFiles = await collectFiles(SOURCE_DIR);
  console.log(`Archivos encontrados: ${String(allFiles.length)}`);

  console.log('Consultando qué ya está subido...');
  const existingKeys = await listExistingKeys();
  console.log(`Ya existentes en el bucket: ${String(existingKeys.size)}`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  await runWithConcurrency(allFiles, CONCURRENCY, async (filePath) => {
    const key = toObjectKey(filePath);
    if (existingKeys.has(key)) {
      skipped += 1;
      return;
    }
    try {
      const body = await readFile(filePath);
      const contentType = CONTENT_TYPE_BY_EXT[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      await client.send(
        new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
      );
      uploaded += 1;
      if (uploaded % 25 === 0) {
        console.log(`  ${String(uploaded)} subidas...`);
      }
    } catch (error) {
      failed += 1;
      console.error(`ERROR subiendo ${key}: ${String(error)}`);
    }
  });

  console.log('\n=== Resumen ===');
  console.log(`Subidas: ${String(uploaded)}`);
  console.log(`Ya existían (omitidas): ${String(skipped)}`);
  console.log(`Fallidas: ${String(failed)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
