import { ApiProperty } from '@nestjs/swagger';

export class HelloWorldJokeRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Identificador idempotente del clic que solicita un chiste.',
  })
  eventId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Identificador efímero de la visita a la aplicación.',
  })
  visitId!: string;
}
