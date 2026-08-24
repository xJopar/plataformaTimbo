import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdministrativeApplicationDto {
  @ApiPropertyOptional({ example: 'Hello World' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Primera aplicación de Plataforma Timbo.',
    nullable: true,
    type: String,
  })
  description?: string | null;

  @ApiPropertyOptional({ example: '/apps/hello-world' })
  launchPath?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  displayOrder?: number;
}
