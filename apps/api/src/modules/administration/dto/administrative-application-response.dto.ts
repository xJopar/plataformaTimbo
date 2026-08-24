import { ApiProperty } from '@nestjs/swagger';
import type { AdministrativeApplication } from '../applications.service';

export class AdministrativeApplicationResponseDto {
  @ApiProperty({ example: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6' })
  id!: string;

  @ApiProperty({ example: 'hello-world' })
  key!: string;

  @ApiProperty({ example: 'Hello World' })
  name!: string;

  @ApiProperty({ example: 'Primera aplicación de Plataforma Timbo.', nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ example: '/apps/hello-world' })
  launchPath!: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE';

  @ApiProperty({ example: 0, minimum: 0 })
  displayOrder!: number;

  @ApiProperty({ example: '2026-08-24T12:00:00.000Z', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-24T12:00:00.000Z', format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ example: null, format: 'date-time', nullable: true, type: String })
  deactivatedAt!: Date | null;
}

export function toAdministrativeApplicationResponse(
  application: AdministrativeApplication,
): AdministrativeApplicationResponseDto {
  return application;
}
