import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContextStore {
  requestId: string;
}

/**
 * Contexto de petición basado en `AsyncLocalStorage`: lo pueden leer servicios futuros
 * (por ejemplo auditoría) sin depender de HTTP ni recibir el `Request` de Express.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  public run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  public getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}
