import { VehicleImagesService } from './vehicle-images.service';

describe('VehicleImagesService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('devuelve [] para un Stock que no está en el manifiesto', async () => {
    const service = new VehicleImagesService();

    await expect(service.getImages('STOCK-SIN-MANIFIESTO')).resolves.toEqual([]);
  });

  it('no falla si el bucket no está configurado: devuelve [] en vez de lanzar', async () => {
    delete process.env.BUCKET;
    delete process.env.ACCESS_KEY_ID;
    delete process.env.SECRET_ACCESS_KEY;
    delete process.env.ENDPOINT;

    const service = new VehicleImagesService();
    // C14824 sí está en vehicle-image-folders.json (Scania P), así que esto fuerza el intento
    // de listar el bucket, que debe fallar de forma controlada por falta de configuración.
    await expect(service.getImages('C14824')).resolves.toEqual([]);
  });

  it('streamImage devuelve null si el bucket no está configurado', async () => {
    delete process.env.BUCKET;
    delete process.env.ACCESS_KEY_ID;
    delete process.env.SECRET_ACCESS_KEY;
    delete process.env.ENDPOINT;

    const service = new VehicleImagesService();
    await expect(service.streamImage('SCANIA/P/C14824/1.webp')).resolves.toBeNull();
  });

  it('streamImage devuelve null para una key que no figura en el listado del bucket', async () => {
    delete process.env.BUCKET;
    delete process.env.ACCESS_KEY_ID;
    delete process.env.SECRET_ACCESS_KEY;
    delete process.env.ENDPOINT;

    const service = new VehicleImagesService();
    await expect(service.streamImage('../../etc/passwd')).resolves.toBeNull();
  });
});
