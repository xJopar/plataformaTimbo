import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import { UsageEventsService } from '../usage-events/usage-events.service';
import { CalculadoraCuotasController } from './calculadora-cuotas.controller';

describe('CalculadoraCuotasController', () => {
  const usageEventsService = { append: jest.fn() };
  const controller = new CalculadoraCuotasController(
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
    usageEventsService.append.mockReset();
    usageEventsService.append.mockResolvedValue({ status: 'recorded' });
  });

  it('registra una exportación con el ID de imagen como objetivo y sólo el origen permitido', async () => {
    await expect(
      controller.recordUsageEvent(
        {
          ...usageIdentifiers,
          eventName: 'calculadora-cuotas.image_exported',
          imageId: 'A1B2C3D4',
          calculationSource: 'manual',
        },
        request,
      ),
    ).resolves.toBeUndefined();

    expect(usageEventsService.append).toHaveBeenCalledWith({
      ...usageIdentifiers,
      actorUserId: request.authenticatedUser?.id,
      eventName: 'calculadora-cuotas.image_exported',
      target: { targetType: 'calculator_image', targetId: 'A1B2C3D4' },
      metadata: { calculationSource: 'manual' },
    });
  });

  it('registra la entrada sin objetivo ni metadata', async () => {
    await controller.recordUsageEvent(
      { ...usageIdentifiers, eventName: 'calculadora-cuotas.opened' },
      request,
    );

    expect(usageEventsService.append).toHaveBeenCalledWith({
      ...usageIdentifiers,
      actorUserId: request.authenticatedUser?.id,
      eventName: 'calculadora-cuotas.opened',
    });
  });

  it('rechaza un ID de imagen que no tiene ocho caracteres alfanuméricos', async () => {
    await expect(
      controller.recordUsageEvent(
        {
          ...usageIdentifiers,
          eventName: 'calculadora-cuotas.image_exported',
          imageId: 'manual',
          calculationSource: 'manual',
        },
        request,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(usageEventsService.append).not.toHaveBeenCalled();
  });
});
