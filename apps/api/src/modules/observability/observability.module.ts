import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { OperationalLoggerService } from './operational-logger.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Module({
  providers: [RequestContextService, OperationalLoggerService, RequestContextMiddleware],
  exports: [RequestContextService, OperationalLoggerService],
})
export class ObservabilityModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
