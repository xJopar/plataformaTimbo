import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkApplicationAccessDto {
  @ApiProperty({ type: [String], example: ['d9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6'] })
  userIds!: string[];
}

export class BulkApplicationAccessResultDto {
  @ApiProperty({ example: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6' })
  userId!: string;

  @ApiProperty({ enum: ['ASSIGNED', 'UNASSIGNED', 'FAILED'], example: 'ASSIGNED' })
  status!: 'ASSIGNED' | 'UNASSIGNED' | 'FAILED';

  @ApiPropertyOptional({
    example: 'El usuario ya tiene asignada la aplicación.',
    description: 'Motivo del fallo; presente únicamente cuando status es FAILED.',
  })
  message?: string;
}
