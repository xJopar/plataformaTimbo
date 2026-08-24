import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAdministrativeApplicationDto {
  @ApiProperty({ example: 'hello-world' })
  key!: string;

  @ApiProperty({ example: 'Hello World' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Primera aplicación de Plataforma Timbo.',
    nullable: true,
    type: String,
  })
  description?: string | null;

  @ApiProperty({ example: '/apps/hello-world' })
  launchPath!: string;

  @ApiProperty({ example: 0, minimum: 0 })
  displayOrder!: number;
}
