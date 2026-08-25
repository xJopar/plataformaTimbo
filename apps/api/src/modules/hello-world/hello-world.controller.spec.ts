import { BadGatewayException } from '@nestjs/common';
import { HelloWorldController } from './hello-world.controller';
import { HelloWorldProviderUnavailableError } from './hello-world.errors';
import { HelloWorldService } from './hello-world.service';

describe('HelloWorldController', () => {
  const helloWorldService = { getJoke: jest.fn() };
  const controller = new HelloWorldController(helloWorldService as unknown as HelloWorldService);

  beforeEach(() => helloWorldService.getJoke.mockReset());

  it('delega la obtención del chiste', async () => {
    const joke = {
      id: 'joke-a',
      originalText: 'A short joke.',
    };
    helloWorldService.getJoke.mockResolvedValue(joke);

    await expect(controller.getJoke()).resolves.toEqual(joke);
    expect(helloWorldService.getJoke).toHaveBeenCalledTimes(1);
  });

  it('traduce una indisponibilidad externa a un error público recuperable', async () => {
    helloWorldService.getJoke.mockRejectedValue(
      new HelloWorldProviderUnavailableError('Proveedor no disponible.'),
    );

    try {
      await controller.getJoke();
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

    await expect(controller.getJoke()).rejects.toBe(unexpectedError);
  });
});
