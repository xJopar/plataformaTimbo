import type { VehicleResponseDto } from './dto/vehicle-response.dto';
import { VehicleImagesService } from './vehicle-images.service';

function row(overrides: Partial<VehicleResponseDto>): VehicleResponseDto {
  return { stock: '', images: [], ...overrides } as VehicleResponseDto;
}

describe('VehicleImagesService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('deja las filas sin cambios cuando ningún stock tiene carpeta en el manifiesto', async () => {
    const service = new VehicleImagesService();
    const rows = [row({ stock: 'STOCK-SIN-MANIFIESTO' })];

    await expect(service.attachImages(rows)).resolves.toBe(rows);
  });

  it('no falla si el bucket no está configurado: devuelve las filas sin fotos', async () => {
    delete process.env.BUCKET;
    delete process.env.ACCESS_KEY_ID;
    delete process.env.SECRET_ACCESS_KEY;
    delete process.env.ENDPOINT;

    const service = new VehicleImagesService();
    // C14824 sí está en vehicle-image-folders.json (Scania P), así que esto fuerza el intento
    // de listar el bucket, que debe fallar de forma controlada por falta de configuración.
    const rows = [row({ stock: 'C14824' })];

    const result = await service.attachImages(rows);
    expect(result).toEqual(rows);
  });
});
