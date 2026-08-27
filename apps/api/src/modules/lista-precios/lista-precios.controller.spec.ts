import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import { UsageEventsService } from '../usage-events/usage-events.service';
import { ListaPreciosController } from './lista-precios.controller';
import { ListaPreciosProviderUnavailableError } from './lista-precios.errors';
import { ListaPreciosService } from './lista-precios.service';

describe('ListaPreciosController', () => {
  const listaPreciosService = { getVehicles: jest.fn() };
  const usageEventsService = { append: jest.fn() };
  const controller = new ListaPreciosController(
    listaPreciosService as unknown as ListaPreciosService,
    usageEventsService as unknown as UsageEventsService,
  );
  const request = {
    authenticatedUser: { id: '7f025649-8238-4958-97a8-f49ea0cd6759' },
  } as AuthenticatedRequest;
  const usageIdentifiers = {
    eventId: '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc',
    visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
  };

  beforeEach(() => {
    listaPreciosService.getVehicles.mockReset();
    usageEventsService.append.mockReset();
    usageEventsService.append.mockResolvedValue({ status: 'recorded' });
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

  it('registra una vista de modelo con objetivo y metadata separados', async () => {
    await expect(
      controller.recordUsageEvent(
        {
          ...usageIdentifiers,
          eventName: 'lista-precios.model_viewed',
          brand: ' FACCHINI ',
          model: ' GRANELERO ',
        },
        request,
      ),
    ).resolves.toBeUndefined();

    expect(usageEventsService.append).toHaveBeenCalledWith({
      ...usageIdentifiers,
      actorUserId: request.authenticatedUser?.id,
      eventName: 'lista-precios.model_viewed',
      target: { targetType: 'vehicle_model', targetId: 'facchini|granelero' },
      metadata: { brand: 'FACCHINI', model: 'GRANELERO' },
    });
  });

  it('registra la apertura de catálogo sin objetivo ni metadata', async () => {
    await controller.recordUsageEvent(
      { ...usageIdentifiers, eventName: 'lista-precios.catalog_opened' },
      request,
    );

    expect(usageEventsService.append).toHaveBeenCalledWith({
      ...usageIdentifiers,
      actorUserId: request.authenticatedUser?.id,
      eventName: 'lista-precios.catalog_opened',
    });
  });

  it('rechaza modelos faltantes antes de escribir el evento', async () => {
    await expect(
      controller.recordUsageEvent(
        { ...usageIdentifiers, eventName: 'lista-precios.model_viewed', brand: 'FACCHINI' },
        request,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usageEventsService.append).not.toHaveBeenCalled();
  });
});
