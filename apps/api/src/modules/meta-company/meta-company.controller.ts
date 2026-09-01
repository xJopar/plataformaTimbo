import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { APPLICATION_AUTHORIZATION_SERVICE } from '../access-profiles/access-profiles.tokens';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import { CommercialGoalType } from '../../generated/meta-company-prisma/client';
import {
  META_COMPANY_APPLICATION_KEY,
  MetaCompanyApplicationAccessGuard,
} from './meta-company-application-access.guard';
import {
  MetaCompanyCapabilitiesResponseDto,
  MetaCompanyCatalogItemResponseDto,
  MetaCompanyCatalogResponseDto,
  CreateMetaCompanyCatalogItemDto,
  CreateMetaCompanyGoalDto,
  MetaCompanyGoalResponseDto,
  SetMetaCompanyCatalogItemActiveDto,
  UpdateMetaCompanyGoalDto,
} from './dto/meta-company.dto';
import {
  MetaCompanyCatalogManagementGuard,
  MetaCompanyGoalManagementGuard,
} from './meta-company-permission.guards';
import { MetaCompanyService } from './meta-company.service';

@ApiTags('applications')
@Controller('applications/meta-company')
@UseGuards(SessionAuthenticationGuard, MetaCompanyApplicationAccessGuard)
export class MetaCompanyController {
  public constructor(
    private readonly metaCompanyService: MetaCompanyService,
    @Inject(APPLICATION_AUTHORIZATION_SERVICE)
    private readonly applicationAuthorizationService: ApplicationAuthorizationService,
  ) {}

  @Get('goals')
  @ApiOperation({
    operationId: 'listMetaCompanyGoals',
    summary: 'Lista metas comerciales por período.',
  })
  @ApiOkResponse({ type: MetaCompanyGoalResponseDto, isArray: true })
  public async listGoals(@Query('period') period?: string): Promise<MetaCompanyGoalResponseDto[]> {
    return (await this.metaCompanyService.listGoals(period)).map(toGoalResponse);
  }

  @Get('catalogs')
  @ApiOperation({
    operationId: 'listMetaCompanyCatalogs',
    summary: 'Lista marcas y negocios activos.',
  })
  @ApiOkResponse({ type: MetaCompanyCatalogResponseDto })
  public async listCatalogs(): Promise<MetaCompanyCatalogResponseDto> {
    return this.metaCompanyService.listCatalogs();
  }

  @Get('catalogs/all')
  @UseGuards(MetaCompanyCatalogManagementGuard)
  @ApiOperation({
    operationId: 'listAllMetaCompanyCatalogs',
    summary: 'Lista todos los catálogos para administración.',
  })
  @ApiOkResponse({ type: MetaCompanyCatalogResponseDto })
  public async listAllCatalogs(): Promise<MetaCompanyCatalogResponseDto> {
    return this.metaCompanyService.listCatalogs(true);
  }

  @Get('capabilities')
  @ApiOperation({
    operationId: 'getMetaCompanyCapabilities',
    summary: 'Obtiene las acciones habilitadas para la sesión.',
  })
  @ApiOkResponse({ type: MetaCompanyCapabilitiesResponseDto })
  public async getCapabilities(
    @Req() request: AuthenticatedRequest,
  ): Promise<MetaCompanyCapabilitiesResponseDto> {
    const userId = requireAuthenticatedUserId(request);
    const [canManageCatalogs, canManageGoals] = await Promise.all([
      this.applicationAuthorizationService.hasApplicationPermission(
        userId,
        META_COMPANY_APPLICATION_KEY,
        'manage-catalogs',
      ),
      this.applicationAuthorizationService.hasApplicationPermission(
        userId,
        META_COMPANY_APPLICATION_KEY,
        'manage-goals',
      ),
    ]);
    return { canManageCatalogs, canManageGoals };
  }

  @Post('goals')
  @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard)
  @ApiOperation({ operationId: 'createMetaCompanyGoal', summary: 'Crea una meta comercial.' })
  @ApiBody({ type: CreateMetaCompanyGoalDto })
  @ApiCreatedResponse({ type: MetaCompanyGoalResponseDto })
  public async createGoal(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ): Promise<MetaCompanyGoalResponseDto> {
    return toGoalResponse(
      await this.metaCompanyService.createGoal({
        ...parseGoalBody(body),
        actorUserId: requireAuthenticatedUserId(request),
      }),
    );
  }

  @Patch('goals/:id')
  @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard)
  @ApiBody({ type: UpdateMetaCompanyGoalDto })
  @ApiOperation({
    operationId: 'updateMetaCompanyGoal',
    summary: 'Edita el valor de una meta comercial.',
  })
  @ApiOkResponse({ type: MetaCompanyGoalResponseDto })
  public async updateGoal(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<MetaCompanyGoalResponseDto> {
    return toGoalResponse(
      await this.metaCompanyService.updateGoal(
        Number(id),
        parseString(body.value),
        requireAuthenticatedUserId(request),
      ),
    );
  }

  @Post('brands')
  @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard)
  @ApiOperation({ operationId: 'createMetaCompanyBrand', summary: 'Crea una marca.' })
  @ApiBody({ type: CreateMetaCompanyCatalogItemDto })
  @ApiCreatedResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async createBrand(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.metaCompanyService.createBrand(
      parseString(body.name),
      requireAuthenticatedUserId(request),
    );
  }

  @Post('businesses')
  @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard)
  @ApiOperation({ operationId: 'createMetaCompanyBusiness', summary: 'Crea un negocio.' })
  @ApiBody({ type: CreateMetaCompanyCatalogItemDto })
  @ApiCreatedResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async createBusiness(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.metaCompanyService.createBusiness(
      parseString(body.name),
      requireAuthenticatedUserId(request),
    );
  }

  @Patch('brands/:id/active')
  @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard)
  @ApiOperation({
    operationId: 'setMetaCompanyBrandActive',
    summary: 'Activa o desactiva una marca.',
  })
  @ApiBody({ type: SetMetaCompanyCatalogItemActiveDto })
  @ApiOkResponse({ description: 'Estado de marca actualizado.' })
  public async setBrandActive(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<void> {
    await this.metaCompanyService.setBrandActive(
      Number(id),
      parseBoolean(body.active),
      requireAuthenticatedUserId(request),
    );
  }

  @Patch('businesses/:id/active')
  @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard)
  @ApiOperation({
    operationId: 'setMetaCompanyBusinessActive',
    summary: 'Activa o desactiva un negocio.',
  })
  @ApiBody({ type: SetMetaCompanyCatalogItemActiveDto })
  @ApiOkResponse({ description: 'Estado de negocio actualizado.' })
  public async setBusinessActive(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ): Promise<void> {
    await this.metaCompanyService.setBusinessActive(
      Number(id),
      parseBoolean(body.active),
      requireAuthenticatedUserId(request),
    );
  }
}

function parseGoalBody(body: Record<string, unknown>) {
  return {
    period: parseString(body.period),
    businessId: parseNumber(body.businessId),
    brandId: parseNumber(body.brandId),
    salespersonCode:
      body.salespersonCode === undefined ? undefined : parseNumber(body.salespersonCode),
    goalType: parseString(body.goalType) as 'Marca' | 'Vendedor',
    value: parseString(body.value),
  };
}

function parseString(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('La solicitud es inválida.');
  return value;
}

function parseNumber(value: unknown): number {
  if (typeof value !== 'number') throw new BadRequestException('La solicitud es inválida.');
  return value;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException('La solicitud es inválida.');
  return value;
}

function requireAuthenticatedUserId(request: AuthenticatedRequest): string {
  const user = request.authenticatedUser;
  if (user === undefined) throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
  return user.id;
}

function toGoalResponse(goal: {
  id: number;
  period: Date;
  businessId: number;
  brandId: number;
  salespersonCode: number | null;
  goalType: CommercialGoalType;
  value: { toFixed: (digits: number) => string };
  updatedAt: Date | null;
  business: { name: string };
  brand: { name: string };
}): MetaCompanyGoalResponseDto {
  return {
    id: goal.id,
    period: goal.period.toISOString().slice(0, 10),
    businessId: goal.businessId,
    businessName: goal.business.name,
    brandId: goal.brandId,
    brandName: goal.brand.name,
    salespersonCode: goal.salespersonCode,
    goalType: goal.goalType === CommercialGoalType.BRAND ? 'Marca' : 'Vendedor',
    value: goal.value.toFixed(2),
    updatedAt: goal.updatedAt?.toISOString() ?? null,
  };
}
