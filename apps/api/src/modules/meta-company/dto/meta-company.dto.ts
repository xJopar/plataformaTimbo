import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetaCompanyEmpresaResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'TIMBO' }) code!: string;
  @ApiProperty({ example: 'Timbo' }) name!: string;
  @ApiProperty({ example: true }) active!: boolean;
}

export class MetaCompanyCatalogItemResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 1 }) empresaId!: number;
  @ApiProperty({ example: 'Comercial' }) name!: string;
  @ApiProperty({ example: true }) active!: boolean;
}

export class MetaCompanyAdvisorResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 1 }) empresaId!: number;
  @ApiProperty({ example: 'SAP_B1' }) sourceSystem!: string;
  @ApiProperty({ example: '10' }) externalCode!: string;
  @ApiProperty({ example: 'Hugo Baez' }) displayName!: string;
  @ApiProperty({ enum: ['PERSON', 'SALES_CHANNEL'] }) kind!: 'PERSON' | 'SALES_CHANNEL';
  @ApiProperty({ example: true }) active!: boolean;
}

export class MetaCompanyCatalogResponseDto {
  @ApiProperty({ type: MetaCompanyEmpresaResponseDto, isArray: true })
  empresas!: MetaCompanyEmpresaResponseDto[];
  @ApiProperty({ type: MetaCompanyCatalogItemResponseDto, isArray: true })
  brands!: MetaCompanyCatalogItemResponseDto[];
  @ApiProperty({ type: MetaCompanyCatalogItemResponseDto, isArray: true })
  businesses!: MetaCompanyCatalogItemResponseDto[];
  @ApiProperty({ type: MetaCompanyAdvisorResponseDto, isArray: true })
  advisors!: MetaCompanyAdvisorResponseDto[];
}

export class MetaCompanyBrandGoalResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: '2026-09-01' }) period!: string;
  @ApiProperty({ example: 1 }) businessId!: number;
  @ApiProperty({ example: 'Comercial' }) businessName!: string;
  @ApiProperty({ example: 1 }) brandId!: number;
  @ApiProperty({ example: 'FACCHINI' }) brandName!: string;
  @ApiProperty({ example: '38237.42' }) value!: string;
  @ApiPropertyOptional({ example: '2026-09-01T12:00:00.000Z', nullable: true, type: String }) updatedAt!: string | null;
}

export class MetaCompanyAdvisorGoalResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: '2026-09-01' }) period!: string;
  @ApiProperty({ example: 1 }) businessId!: number;
  @ApiProperty({ example: 'FIXIT' }) businessName!: string;
  @ApiPropertyOptional({ example: 1, nullable: true, type: Number }) brandId!: number | null;
  @ApiPropertyOptional({ example: 'Marca de repuesto', nullable: true, type: String }) brandName!: string | null;
  @ApiProperty({ example: 1 }) advisorId!: number;
  @ApiProperty({ example: '195fix' }) advisorCode!: string;
  @ApiProperty({ example: 'FIX0ASU0JUAN FERREIRA' }) advisorName!: string;
  @ApiProperty({ example: '31708.00' }) value!: string;
  @ApiPropertyOptional({ example: 22, nullable: true, type: Number }) workingDays!: number | null;
  @ApiPropertyOptional({ example: '2026-09-01T12:00:00.000Z', nullable: true, type: String }) updatedAt!: string | null;
}

export class MetaCompanyGoalsResponseDto {
  @ApiProperty({ type: MetaCompanyBrandGoalResponseDto, isArray: true })
  brandGoals!: MetaCompanyBrandGoalResponseDto[];
  @ApiProperty({ type: MetaCompanyAdvisorGoalResponseDto, isArray: true })
  advisorGoals!: MetaCompanyAdvisorGoalResponseDto[];
}

export class MetaCompanyCapabilitiesResponseDto {
  @ApiProperty() canManageCatalogs!: boolean;
  @ApiProperty() canManageGoals!: boolean;
}

export class CreateMetaCompanyEmpresaDto {
  @ApiProperty({ example: 'TIMBO' }) code!: string;
  @ApiProperty({ example: 'Timbo' }) name!: string;
}

export class CreateMetaCompanyCatalogItemDto {
  @ApiProperty({ example: 1 }) empresaId!: number;
  @ApiProperty({ example: 'Comercial' }) name!: string;
}

export class CreateMetaCompanyAdvisorDto {
  @ApiProperty({ example: 1 }) empresaId!: number;
  @ApiProperty({ example: 'SAP_B1' }) sourceSystem!: string;
  @ApiProperty({ example: '10' }) externalCode!: string;
  @ApiProperty({ example: 'Hugo Baez' }) displayName!: string;
  @ApiProperty({ enum: ['PERSON', 'SALES_CHANNEL'], example: 'PERSON' })
  kind!: 'PERSON' | 'SALES_CHANNEL';
}

export class UpdateMetaCompanyAdvisorDto extends CreateMetaCompanyAdvisorDto {}

export class CreateMetaCompanyBrandGoalDto {
  @ApiProperty({ example: '2026-09-01' }) period!: string;
  @ApiProperty({ example: 1 }) businessId!: number;
  @ApiProperty({ example: 1 }) brandId!: number;
  @ApiProperty({ example: '38237.42' }) value!: string;
}

export class CreateMetaCompanyAdvisorGoalDto {
  @ApiProperty({ example: '2026-09-01' }) period!: string;
  @ApiProperty({ example: 1 }) businessId!: number;
  @ApiPropertyOptional({ example: 1 }) brandId?: number;
  @ApiProperty({ example: 1 }) advisorId!: number;
  @ApiProperty({ example: '38237.42' }) value!: string;
  @ApiPropertyOptional({ example: 22 }) workingDays?: number;
}

export class UpdateMetaCompanyGoalDto {
  @ApiProperty({ example: '38237.42' }) value!: string;
  @ApiPropertyOptional({ example: 22 }) workingDays?: number;
}

export class SetMetaCompanyCatalogItemActiveDto {
  @ApiProperty({ example: false }) active!: boolean;
}

export class MetaCompanyAdvisorGoalListItemDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: '2026-09-01' }) period!: string;
  @ApiProperty({ example: 1 }) businessId!: number;
  @ApiProperty({ example: 'Comercial' }) businessName!: string;
  @ApiPropertyOptional({ example: 1, nullable: true, type: Number }) brandId!: number | null;
  @ApiProperty({ example: 'No aplica' }) brandName!: string;
  @ApiPropertyOptional({ example: 10, nullable: true, type: Number }) salespersonCode!: number | null;
  @ApiProperty({ enum: ['Marca', 'Vendedor'] }) goalType!: 'Marca' | 'Vendedor';
  @ApiProperty({ example: '38237.42' }) value!: string;
  @ApiPropertyOptional({ example: '2026-09-01T12:00:00.000Z', nullable: true, type: String }) updatedAt!: string | null;
}
