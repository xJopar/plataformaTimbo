import { S3Client, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

/**
 * Renombra un prefijo (carpeta lógica) dentro del bucket S3-compatible de Railway. S3 no tiene
 * rename real: copia cada objeto bajo el prefijo nuevo y borra el original.
 *
 * Uso:
 *   node --env-file=.env rename-bucket-prefix.mjs "<prefijoViejo>" "<prefijoNuevo>"
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
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

const [oldPrefixRaw, newPrefixRaw] = process.argv.slice(2);
if (!oldPrefixRaw || !newPrefixRaw) {
  console.error('Uso: node rename-bucket-prefix.mjs "<prefijoViejo>" "<prefijoNuevo>"');
  process.exit(1);
}
const oldPrefix = oldPrefixRaw.endsWith('/') ? oldPrefixRaw : `${oldPrefixRaw}/`;
const newPrefix = newPrefixRaw.endsWith('/') ? newPrefixRaw : `${newPrefixRaw}/`;

async function listKeysUnder(prefix) {
  const keys = [];
  let continuationToken;
  do {
    const response = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    for (const object of response.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function main() {
  console.log(`Bucket: ${BUCKET}`);
  console.log(`De: ${oldPrefix}`);
  console.log(`A:  ${newPrefix}`);

  const keys = await listKeysUnder(oldPrefix);
  console.log(`Objetos encontrados bajo el prefijo viejo: ${String(keys.length)}`);
  if (keys.length === 0) {
    console.log('Nada para renombrar.');
    return;
  }

  for (const key of keys) {
    const newKey = newPrefix + key.slice(oldPrefix.length);
    await client.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `/${BUCKET}/${encodeURIComponent(key)}`,
        Key: newKey,
      }),
    );
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    console.log(`${key} -> ${newKey}`);
  }

  console.log('\nListo.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
