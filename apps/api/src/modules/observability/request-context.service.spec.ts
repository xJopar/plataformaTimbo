import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  it('no expone requestId fuera de un run()', () => {
    const requestContext = new RequestContextService();
    expect(requestContext.getRequestId()).toBeUndefined();
  });

  it('expone el requestId sólo dentro del callback de run()', () => {
    const requestContext = new RequestContextService();

    const observedInsideRun = requestContext.run({ requestId: 'request-a' }, () =>
      requestContext.getRequestId(),
    );

    expect(observedInsideRun).toBe('request-a');
    expect(requestContext.getRequestId()).toBeUndefined();
  });

  it('aísla el contexto entre ejecuciones asíncronas concurrentes', async () => {
    const requestContext = new RequestContextService();

    const observe = (requestId: string): Promise<string | undefined> =>
      requestContext.run({ requestId }, async () => {
        await new Promise((resolve) => setTimeout(resolve, requestId === 'request-a' ? 10 : 0));
        return requestContext.getRequestId();
      });

    const [observedA, observedB] = await Promise.all([observe('request-a'), observe('request-b')]);

    expect(observedA).toBe('request-a');
    expect(observedB).toBe('request-b');
  });
});
