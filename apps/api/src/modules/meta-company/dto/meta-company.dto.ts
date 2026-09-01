import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaCompanyCatalogItemResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'Comercial' }) name!: string;
  @ApiProperty({ example: true }) active!: boolean;
}

export class MetaCompanyCatalogResponseDto {
  @ApiProperty({ type: MetaCompanyCatalogItemResponseDto, isArray: true })
  brands!: MetaCompanyCatalogItemResponseDto[];
  @ApiProperty({ type: MetaCompanyCatalogItemResponseDto, isArray: true })
  businesses!: MetaCompanyCatalogItemResponseDto[];
}

export class MetaCompanyGoalResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: '2025-01-01' }) period!: string;
  @ApiProperty({ example: 1 }) businessId!: number;
  @ApiProperty({ example: 'Comercial' }) businessName!: string;
  @ApiProperty({ example: 1 }) brandId!: number;
  @ApiProperty({ example: 'FACCINI' }) brandName!: string;
  @ApiPropertyOptional({ example: 10 }) salespersonCode!: number | null;
  @ApiProperty({ enum: ['Marca', 'Vendedor'] }) goalType!: 'Marca' | 'Vendedor';
  @ApiProperty({ example: '38237.42' }) value!: string;
  @ApiPropertyOptional({ example: '2025-01-01T12:00:00.000Z' }) updatedAt!: string | null;
}

export class MetaCompanyCapabilitiesResponseDto {
  @ApiProperty() canManageCatalogs!: boolean;
  @ApiProperty() canManageGoals!: boolean;
}

export class CreateMetaCompanyGoalDto {
  @ApiProperty({ example: '2026-09-01' }) period!: string;
  @ApiProperty({ example: 1 }) businessId!: number;
  @ApiProperty({ example: 1 }) brandId!: number;
  @ApiPropertyOptional({ example: 10 }) salespersonCode?: number;
  @ApiProperty({ enum: ['Marca', 'Vendedor'], example: 'Marca' }) goalType!: 'Marca' | 'Vendedor';
  @ApiProperty({ example: '38237.42' }) value!: string;
}

export class UpdateMetaCompanyGoalDto {
  @ApiProperty({ example: '38237.42' }) value!: string;
}

export class CreateMetaCompanyCatalogItemDto {
  @ApiProperty({ example: 'Comercial' }) name!: string;
}

export class SetMetaCompanyCatalogItemActiveDto {
  @ApiProperty({ example: false }) active!: boolean;
}
