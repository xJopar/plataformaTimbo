import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LISTA_PRECIOS_USAGE_EVENT_NAMES } from '../lista-precios-usage-events';

export class ListaPreciosUsageEventRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Identificador idempotente del evento de uso.' })
  eventId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Identificador efímero de la visita a Lista de Precios.',
  })
  visitId!: string;

  @ApiProperty({
    enum: LISTA_PRECIOS_USAGE_EVENT_NAMES,
    description: 'Hito de uso permitido por Lista de Precios.',
  })
  eventName!: string;

  @ApiPropertyOptional({ description: 'Marca del modelo visto o consultado.' })
  brand?: string;

  @ApiPropertyOptional({ description: 'Modelo visto o consultado.' })
  model?: string;
}
