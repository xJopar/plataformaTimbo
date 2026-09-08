import { access, mkdir, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

/**
 * Genera una miniatura real (WebP, ~200px, liviana) por cada foto ya organizada en
 * imagenes_lista_precios/, para no seguir bajando la imagen de resolución completa solo para
 * mostrarla del tamaño de una miniatura en la tira de la galería.
 *
 * La miniatura de "MARCA/MODELO/STOCK/2.jpg" se guarda como "MARCA/MODELO/STOCK/thumbs/2.webp"
 * — mismo número de archivo, carpeta "thumbs" al lado, siempre WebP sin importar el formato
 * original. `upload-to-bucket.mjs` sube todo lo que encuentre bajo la carpeta, así que después de
 * correr este script alcanza con volver a correr esa subida (es reanudable: solo sube lo nuevo).
 *
 * Uso:
 *   node generate-thumbnails.mjs [carpetaImagenes]
 */

const SOURCE_DIR = process.argv[2] ?? 'C:\\Users\\desarrollo4.ti\\Downloads\\imagenes_lista_precios';
const THUMB_DIR_NAME = 'thumbs';
const THUMB_MAX_SIZE = 200;
const THUMB_QUALITY = 72;
const IMAGE_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']);
const CONCURRENCY = 4;

async function collectImages(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === THUMB_DIR_NAME) continue; // no generar miniatura de una miniatura
      files.push(...(await collectImages(join(dir, entry.name))));
    } else if (IMAGE_EXTS.has(extname(entry.name).toLowerCase())) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function thumbPathFor(imagePath) {
  const dir = join(imagePath, '..');
  const base = basename(imagePath, extname(imagePath));
  return join(dir, THUMB_DIR_NAME, `${base}.webp`);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runWithConcurrency(items, limit, worker) {
  let nextIndex = 0;
  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
}

async function main() {
  console.log(`Origen: ${SOURCE_DIR}`);
  const images = await collectImages(SOURCE_DIR);
  console.log(`Fotos encontradas: ${String(images.length)}`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  await runWithConcurrency(images, CONCURRENCY, async (imagePath) => {
    const outPath = thumbPathFor(imagePath);
    if (await pathExists(outPath)) {
      skipped += 1;
      return;
    }
    try {
      await mkdir(join(outPath, '..'), { recursive: true });
      await sharp(imagePath)
        .resize({ width: THUMB_MAX_SIZE, height: THUMB_MAX_SIZE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(outPath);
      generated += 1;
      if (generated % 25 === 0) {
        console.log(`  ${String(generated)} miniaturas generadas...`);
      }
    } catch (error) {
      failed += 1;
      console.error(`ERROR generando miniatura de ${imagePath}: ${String(error)}`);
    }
  });

  console.log('\n=== Resumen ===');
  console.log(`Generadas: ${String(generated)}`);
  console.log(`Ya existían (omitidas): ${String(skipped)}`);
  console.log(`Fallidas: ${String(failed)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
