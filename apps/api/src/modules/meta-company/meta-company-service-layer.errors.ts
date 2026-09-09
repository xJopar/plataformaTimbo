import { ServiceUnavailableException } from '@nestjs/common';

export class MetaCompanyServiceLayerUnavailableError extends ServiceUnavailableException {
  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'MetaCompanyServiceLayerUnavailableError';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
