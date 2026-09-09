import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CALCULADORA_CUOTAS_CALCULATION_SOURCES,
  CALCULADORA_CUOTAS_USAGE_EVENT_NAMES,
} from '../calculadora-cuotas-usage-events';

export class CalculadoraCuotasUsageEventRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Identificador idempotente del evento de uso.' })
  eventId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Identificador efímero de la visita a Calculadora de Cuotas.',
  })
  visitId!: string;

  @ApiProperty({
    enum: CALCULADORA_CUOTAS_USAGE_EVENT_NAMES,
    description: 'Hito de uso permitido por Calculadora de Cuotas.',
  })
  eventName!: string;

  @ApiPropertyOptional({
    pattern: '^[A-Z0-9]{8}$',
    description: 'Identificador visible de ocho caracteres de la imagen exportada.',
  })
  imageId?: string;

  @ApiPropertyOptional({
    enum: CALCULADORA_CUOTAS_CALCULATION_SOURCES,
    description: 'Origen de las unidades incluidas al exportar la imagen.',
  })
  calculationSource?: string;
}
