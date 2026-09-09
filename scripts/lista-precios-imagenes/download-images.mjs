import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, extname, basename } from 'node:path';

/**
 * Fase B del plan de imágenes de Lista de Precios.
 *
 * Lee `resolved-permalinks.json` (generado en la Fase A por `resolve-permalinks.py`, que
 * reproduce el COALESCE(Stock, CodGrupoUnidad, CodGrupoUnidad-normalizado) contra ELICE_URLS) y
 * para cada permalink único descarga las imágenes de la galería del producto en timbo.com.py,
 * organizándolas en:
 *   - <MARCA>/<MODELO>/<STOCK>/       para unidades con foto propia (matchBy "stock").
 *   - <MARCA>/<MODELO>/<CODIGO_GRUPO>/ para el default curado de ese grupo (matchBy "grupo").
 *   - nada (sin carpeta) para matchBy "sin_match" — sólo quedan listadas en el reporte.
 *
 * Uso:
 *   node scripts/lista-precios-imagenes/download-images.mjs [resolved-permalinks.json] [carpetaSalida]
 *
 * Sin dependencias externas: usa fetch nativo de Node y una extracción de imágenes por el
 * atributo data-thumb del carrusel de producto (ver GALLERY_IMAGE_REGEX más abajo).
 */

const INPUT_PATH = process.argv[2] ?? join(import.meta.dirname, 'resolved-permalinks.json');
const OUT_DIR =
  process.argv[3] ?? 'C:\\Users\\desarrollo4.ti\\Downloads\\imagenes_lista_precios';

const CONCURRENCY = 4;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * El sitio corre un optimizador de imágenes (SiteGround Optimizer) que reescribe cualquier
 * .png/.jpg a WebP on-the-fly según el header Accept — sin importar la extensión de la URL. Si el
 * request no manda un Accept "de navegador", el servidor responde 200 con un HTML (redirect a la
 * home) en vez de la imagen. Hay que pedir explícitamente tipos de imagen para recibir el archivo
 * real, y después usar el content-type de la respuesta (no la extensión de la URL) para nombrarlo.
 */
const IMAGE_ACCEPT_HEADER = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';

const EXTENSION_BY_CONTENT_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};

/**
 * Las páginas de producto (Elementor + WooCommerce gallery) marcan cada imagen de la galería con
 * el atributo `data-thumb="<url>"` en el carrusel (`wd-carousel-item` / `woocommerce-product-
 * gallery__image`). Es el único marcador que aísla las fotos reales del producto: el resto del
 * HTML reutiliza wp-content/uploads también para el logo, íconos, banners y la sección de
 * "productos relacionados" (otras unidades), que no queremos mezclar en la descarga.
 */
const GALLERY_IMAGE_REGEX =
  /data-thumb="(https?:\/\/timbo\.com\.py\/wp-content\/uploads\/[^"]+\.(?:png|jpe?g|webp|gif))"/gi;

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/** Quita el sufijo de tamaño que WordPress agrega a los thumbnails: "-700x394" antes de la extensión. */
function toFullResolutionUrl(url) {
  return url.replace(/-\d{2,5}x\d{2,5}(?=\.\w+$)/, '');
}

/** Nombre de archivo base sin sufijo de tamaño, usado para deduplicar variantes del mismo original. */
function dedupeKey(url) {
  return basename(toFullResolutionUrl(url)).toLowerCase();
}

function sanitizeForPath(value) {
  const cleaned = (value ?? '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || 'SIN_DATO';
}

/**
 * Carpetas segmentadas por Marca/Modelo (pedido del usuario) con un último nivel que evita
 * mezclar fotos que en realidad son distintas:
 *   - matchBy "stock": <MARCA>/<MODELO>/<STOCK>/ (foto propia de esa unidad).
 *   - matchBy "grupo": <MARCA>/<MODELO>/<CODIGO_GRUPO>/ (default curado — el código de grupo,
 *     no Config/Susp/TipoMotor, es la clave real de unificación: dos stocks con el mismo grupo
 *     comparten carpeta aunque su Config/Susp/TipoMotor difiera en el texto).
 *   - matchBy "sin_match": sin carpeta, no se descarga nada (se deja constancia en el reporte).
 */
function destinationFoldersFor(row) {
  if (row.matchBy === 'sin_match' || !row.permalink) {
    return [];
  }
  const marcaModelo = [sanitizeForPath(row.marca), sanitizeForPath(row.modelo)];
  if (row.matchBy === 'stock') {
    return [{ path: join(OUT_DIR, ...marcaModelo, sanitizeForPath(row.stock)) }];
  }
  return [{ path: join(OUT_DIR, ...marcaModelo, sanitizeForPath(row.resolvedGroupCode)) }];
}

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

function extractGalleryImageUrls(html) {
  const byKey = new Map();

  for (const match of html.matchAll(GALLERY_IMAGE_REGEX)) {
    const fullResUrl = toFullResolutionUrl(match[1]);
    const key = dedupeKey(fullResUrl);
    if (!byKey.has(key)) {
      byKey.set(key, fullResUrl);
    }
  }

  // Fallback por si la página no usa el carrusel wd-carousel-item: al menos la imagen principal.
  if (byKey.size === 0) {
    const ogImageMatch = /property="og:image"\s+content="([^"]+)"/i.exec(html);
    if (ogImageMatch) {
      const fullResUrl = toFullResolutionUrl(ogImageMatch[1]);
      byKey.set(dedupeKey(fullResUrl), fullResUrl);
    }
  }

  return [...byKey.values()];
}

function filenameForResponse(imageUrl, contentType) {
  const original = basename(imageUrl);
  const realExtension = EXTENSION_BY_CONTENT_TYPE[(contentType ?? '').split(';')[0].trim()];
  if (!realExtension) {
    return original;
  }
  const originalExtension = extname(original);
  if (originalExtension.toLowerCase() === realExtension) {
    return original;
  }
  return original.slice(0, original.length - originalExtension.length) + realExtension;
}

async function resolvePermalinkImages(permalink) {
  const pageResponse = await fetchWithRetry(permalink, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  const html = await pageResponse.text();
  const imageUrls = extractGalleryImageUrls(html);

  const downloaded = [];
  for (const imageUrl of imageUrls) {
    try {
      const imageResponse = await fetchWithRetry(imageUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: IMAGE_ACCEPT_HEADER },
      });
      const contentType = imageResponse.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`respuesta no es una imagen (content-type: ${contentType || 'desconocido'})`);
      }
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const filename = filenameForResponse(imageUrl, contentType);
      downloaded.push({ url: imageUrl, filename, buffer });
    } catch (error) {
      downloaded.push({ url: imageUrl, filename: basename(imageUrl), error: String(error) });
    }
  }
  return downloaded;
}

async function writeImagesToFolder(folderPath, images) {
  await mkdir(folderPath, { recursive: true });
  let written = 0;
  for (const image of images) {
    if (image.error || !image.buffer) continue;
    const destPath = join(folderPath, image.filename);
    if (await pathExists(destPath)) {
      written += 1;
      continue;
    }
    await writeFile(destPath, image.buffer);
    written += 1;
  }
  return written;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

function toCsvValue(value) {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const rawInput = await readFile(INPUT_PATH, 'utf8');
  /** @type {Array<{stock:string,marca:string,modelo:string,config:string,susp:string,tipoMotor:string,permalink:string,matchBy:string,resolvedGroupCode:string|null}>} */
  const rows = JSON.parse(rawInput);

  console.log(`Filas de entrada: ${String(rows.length)}`);

  const rowsWithPermalink = rows.filter((row) => row.matchBy !== 'sin_match' && row.permalink);
  const rowsWithoutPermalink = rows.filter((row) => row.matchBy === 'sin_match' || !row.permalink);

  const permalinkGroups = new Map();
  for (const row of rowsWithPermalink) {
    const list = permalinkGroups.get(row.permalink) ?? [];
    list.push(row);
    permalinkGroups.set(row.permalink, list);
  }

  console.log(`Permalinks únicos a procesar: ${String(permalinkGroups.size)}`);

  const permalinkEntries = [...permalinkGroups.entries()];
  const reportRowsByStock = new Map();

  await runWithConcurrency(permalinkEntries, CONCURRENCY, async ([permalink, rowsForPermalink]) => {
    let images = [];
    let pageError = '';
    try {
      images = await resolvePermalinkImages(permalink);
    } catch (error) {
      pageError = String(error);
    }

    const imagesOk = images.filter((image) => !image.error);
    const imagesFailed = images.filter((image) => image.error);

    for (const row of rowsForPermalink) {
      const destinations = destinationFoldersFor(row);
      let totalWritten = 0;
      const folderPaths = [];
      for (const destination of destinations) {
        if (imagesOk.length > 0) {
          totalWritten += await writeImagesToFolder(destination.path, imagesOk);
        }
        folderPaths.push(destination.path);
      }

      reportRowsByStock.set(row.stock, {
        stock: row.stock,
        marca: row.marca,
        modelo: row.modelo,
        codGrupoUnidad: row.codGrupoUnidad,
        matchBy: row.matchBy,
        codigoGrupoResuelto: row.resolvedGroupCode ?? '',
        permalink,
        carpetas: folderPaths.join(' | '),
        imagenesEncontradas: images.length,
        imagenesDescargadas: totalWritten,
        error: pageError || (imagesFailed.length > 0 ? `${String(imagesFailed.length)} imagen(es) fallaron` : ''),
      });
    }

    console.log(
      `${pageError ? 'ERROR' : 'OK'} ${permalink} -> ${String(imagesOk.length)} imagen(es), ${String(rowsForPermalink.length)} fila(s) asociadas`,
    );
  });

  for (const row of rowsWithoutPermalink) {
    reportRowsByStock.set(row.stock, {
      stock: row.stock,
      marca: row.marca,
      modelo: row.modelo,
      codGrupoUnidad: row.codGrupoUnidad,
      matchBy: 'sin_match',
      codigoGrupoResuelto: '',
      permalink: '',
      carpetas: '',
      imagenesEncontradas: 0,
      imagenesDescargadas: 0,
      error: 'Sin match en la Fase A (ni Stock ni CodGrupoUnidad tienen permalink en ELICE_URLS)',
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  const header = [
    'stock',
    'marca',
    'modelo',
    'codGrupoUnidad',
    'matchBy',
    'codigoGrupoResuelto',
    'permalink',
    'carpetas',
    'imagenesEncontradas',
    'imagenesDescargadas',
    'error',
  ];
  const csvLines = [header.join(',')];
  for (const reportRow of reportRowsByStock.values()) {
    csvLines.push(header.map((key) => toCsvValue(reportRow[key])).join(','));
  }
  const reportPath = join(OUT_DIR, '_reporte.csv');
  await writeFile(reportPath, csvLines.join('\n'), 'utf8');

  const allReportRows = [...reportRowsByStock.values()];
  const conFotoPropia = allReportRows.filter((r) => r.matchBy === 'stock' && r.imagenesDescargadas > 0).length;
  const conDefault = allReportRows.filter((r) => r.matchBy === 'grupo' && r.imagenesDescargadas > 0).length;
  const sinImagen = allReportRows.filter((r) => r.imagenesDescargadas === 0).length;

  console.log('\n=== Resumen ===');
  console.log(`Total filas: ${String(allReportRows.length)}`);
  console.log(`Con foto propia (por Stock): ${String(conFotoPropia)}`);
  console.log(`Con imagen default (por CodGrupoUnidad): ${String(conDefault)}`);
  console.log(`Sin imagen: ${String(sinImagen)}`);
  console.log(`Reporte: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
