import { BadGatewayException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/session-authentication.guard';
import { HelloWorldController } from './hello-world.controller';
import { HelloWorldProviderUnavailableError } from './hello-world.errors';
import { HelloWorldService } from './hello-world.service';

describe('HelloWorldController', () => {
  const helloWorldService = { getJoke: jest.fn() };
  const usageEventsService = { append: jest.fn() };
  const controller = new HelloWorldController(
    helloWorldService as unknown as HelloWorldService,
    usageEventsService as never,
  );
  const authenticatedUser = { id: '7f025649-8238-4958-97a8-f49ea0cd6759' };
  const request = { authenticatedUser } as AuthenticatedRequest;
  const usageRequest = {
    eventId: '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc',
    visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
  };

  beforeEach(() => {
    helloWorldService.getJoke.mockReset();
    usageEventsService.append.mockReset();
    usageEventsService.append.mockResolvedValue({ status: 'recorded' });
  });

  it('delega la obtención del chiste', async () => {
    const joke = {
      id: 'joke-a',
      originalText: 'A short joke.',
    };
    helloWorldService.getJoke.mockResolvedValue(joke);

    await expect(controller.getJoke(usageRequest, request)).resolves.toEqual(joke);
    expect(helloWorldService.getJoke).toHaveBeenCalledTimes(1);
    expect(usageEventsService.append).toHaveBeenCalledWith({
      ...usageRequest,
      actorUserId: authenticatedUser.id,
      eventName: 'hello-world.joke_requested',
    });
  });

  it('traduce una indisponibilidad externa a un error público recuperable', async () => {
    helloWorldService.getJoke.mockRejectedValue(
      new HelloWorldProviderUnavailableError('Proveedor no disponible.'),
    );

    try {
      await controller.getJoke(usageRequest, request);
      throw new Error('El controller debía rechazar la indisponibilidad externa.');
    } catch (error) {
      expect(error).toBeInstanceOf(BadGatewayException);
      if (!(error instanceof BadGatewayException)) {
        throw error;
      }
      expect(error.getStatus()).toBe(502);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ code: 'HELLO_WORLD_UNAVAILABLE' }),
      );
    }
  });

  it('no oculta errores inesperados', async () => {
    const unexpectedError = new Error('unexpected');
    helloWorldService.getJoke.mockRejectedValue(unexpectedError);

    await expect(controller.getJoke(usageRequest, request)).rejects.toBe(unexpectedError);
  });

  it('no interrumpe el chiste si el evento de uso no pudo persistirse', async () => {
    usageEventsService.append.mockResolvedValue({
      status: 'failed',
      eventId: usageRequest.eventId,
    });
    helloWorldService.getJoke.mockResolvedValue({ id: 'joke-a', originalText: 'A short joke.' });

    await expect(controller.getJoke(usageRequest, request)).resolves.toEqual({
      id: 'joke-a',
      originalText: 'A short joke.',
    });
  });
});
