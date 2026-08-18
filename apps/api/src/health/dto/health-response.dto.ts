import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Estado de disponibilidad de la API.',
  })
  status!: 'ok';

  @ApiProperty({
    example: '2026-08-17T20:15:00.000Z',
    description: 'Marca de tiempo UTC, en formato ISO 8601, en la que se generó la respuesta.',
  })
  timestamp!: string;
}
