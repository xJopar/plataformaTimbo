import { BadGatewayException } from '@nestjs/common';
import { ListaPreciosController } from './lista-precios.controller';
import { ListaPreciosProviderUnavailableError } from './lista-precios.errors';
import { ListaPreciosService } from './lista-precios.service';

describe('ListaPreciosController', () => {
  const listaPreciosService = { getVehicles: jest.fn() };
  const controller = new ListaPreciosController(
    listaPreciosService as unknown as ListaPreciosService,
  );

  beforeEach(() => {
    listaPreciosService.getVehicles.mockReset();
  });

  it('devuelve el catálogo de vehículos mapeado a la respuesta pública', async () => {
    listaPreciosService.getVehicles.mockResolvedValue([
      { marca: 'Sinotruk', modelo: 'Howo', stock: 'ST-001' },
    ]);

    const response = await controller.getVehicles();

    expect(response).toHaveLength(1);
    expect(response[0]).toEqual(
      expect.objectContaining({ marca: 'Sinotruk', modelo: 'Howo', stock: 'ST-001', color: '' }),
    );
    expect(listaPreciosService.getVehicles).toHaveBeenCalledTimes(1);
  });

  it('traduce una indisponibilidad externa a un error público recuperable', async () => {
    listaPreciosService.getVehicles.mockRejectedValue(
      new ListaPreciosProviderUnavailableError('Zoho no disponible.'),
    );

    try {
      await controller.getVehicles();
      throw new Error('El controller debía rechazar la indisponibilidad externa.');
    } catch (error) {
      expect(error).toBeInstanceOf(BadGatewayException);
      if (!(error instanceof BadGatewayException)) {
        throw error;
      }
      expect(error.getStatus()).toBe(502);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ code: 'LISTA_PRECIOS_UNAVAILABLE' }),
      );
    }
  });

  it('no oculta errores inesperados', async () => {
    const unexpectedError = new Error('unexpected');
    listaPreciosService.getVehicles.mockRejectedValue(unexpectedError);

    await expect(controller.getVehicles()).rejects.toBe(unexpectedError);
  });
});
