import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FiveSIndicatorStatus } from '../../../generated/prisma/client';

export class CreateFiveSIndicatorDto {
  @ApiProperty({ example: 'orden-de-cables', description: 'Clave en kebab-case, única.' })
  public key!: string;

  @ApiProperty({ example: 'Orden de cables' })
  public name!: string;

  @ApiProperty({
    example: '2026-08-17',
    description: 'Fecha desde la que se controla (AAAA-MM-DD).',
  })
  public controlledSince!: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  public displayOrder?: number;
}

export class UpdateFiveSIndicatorDto {
  @ApiPropertyOptional({ example: 'Orden de cables' })
  public name?: string;

  @ApiPropertyOptional({ example: '2026-08-17' })
  public controlledSince?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  public displayOrder?: number;
}

export class FiveSIndicatorResponseDto {
  @ApiProperty() public id!: string;
  @ApiProperty() public key!: string;
  @ApiProperty() public name!: string;
  @ApiProperty({ example: '2026-08-17' }) public controlledSince!: string;
  @ApiProperty() public displayOrder!: number;
  @ApiProperty({ enum: FiveSIndicatorStatus }) public status!: FiveSIndicatorStatus;
}
