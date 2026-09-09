import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkAdministrativeUserStatusDto {
  @ApiProperty({
    type: [String],
    example: ['d9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6'],
    description: 'Identificadores de usuarios a los que se aplicará el cambio de estado.',
  })
  userIds!: string[];
}

export class BulkAdministrativeUserStatusResultDto {
  @ApiProperty({ example: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6' })
  userId!: string;

  @ApiProperty({ enum: ['UPDATED', 'SKIPPED', 'REJECTED'], example: 'UPDATED' })
  status!: 'UPDATED' | 'SKIPPED' | 'REJECTED';

  @ApiPropertyOptional({
    example: 'Primero se debe revocar el rol de administrador de plataforma.',
  })
  message?: string;
}
