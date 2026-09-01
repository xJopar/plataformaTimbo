import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { APPLICATION_AUTHORIZATION_SERVICE } from '../access-profiles/access-profiles.tokens';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import { type AuthenticatedRequest, SessionAuthenticationGuard } from '../auth/session-authentication.guard';
import { META_COMPANY_APPLICATION_KEY, MetaCompanyApplicationAccessGuard } from './meta-company-application-access.guard';
import { CreateMetaCompanyAdvisorDto, CreateMetaCompanyAdvisorGoalDto, CreateMetaCompanyBrandGoalDto, CreateMetaCompanyCatalogItemDto, CreateMetaCompanyEmpresaDto, MetaCompanyCapabilitiesResponseDto, MetaCompanyCatalogResponseDto, UpdateMetaCompanyGoalDto } from './dto/meta-company.dto';
import { MetaCompanyCatalogManagementGuard, MetaCompanyGoalManagementGuard } from './meta-company-permission.guards';
import { MetaCompanyService } from './meta-company.service';

@ApiTags('applications')
@Controller('applications/meta-company')
@UseGuards(SessionAuthenticationGuard, MetaCompanyApplicationAccessGuard)
export class MetaCompanyController {
  public constructor(private readonly metaCompanyService: MetaCompanyService, @Inject(APPLICATION_AUTHORIZATION_SERVICE) private readonly applicationAuthorizationService: ApplicationAuthorizationService) {}

  @Get('goals')
  @ApiOperation({ operationId: 'listMetaCompanyGoals', summary: 'Lista metas comerciales por periodo y empresa.' })
  @ApiOkResponse()
  public async listGoals(@Query('period') period?: string, @Query('empresaId') empresaId?: string): Promise<unknown[]> {
    const goals = await this.metaCompanyService.listGoals(period, empresaId === undefined ? undefined : Number(empresaId));
    return [
      ...goals.brandGoals.map((goal) => ({ id: goal.id, period: goal.period.toISOString().slice(0, 10), businessId: goal.businessId, businessName: goal.business.name, brandId: goal.brandId, brandName: goal.brand.name, salespersonCode: null, goalType: 'Marca', value: goal.value.toFixed(2), updatedAt: goal.updatedAt?.toISOString() ?? null })),
      ...goals.advisorGoals.map((goal) => ({ id: goal.id, period: goal.period.toISOString().slice(0, 10), businessId: goal.businessId, businessName: goal.business.name, brandId: goal.brandId, brandName: goal.brand?.name ?? 'No aplica', salespersonCode: Number.isSafeInteger(Number(goal.advisor.externalCode)) ? Number(goal.advisor.externalCode) : null, goalType: 'Vendedor', value: goal.value.toFixed(2), updatedAt: goal.updatedAt?.toISOString() ?? null })),
    ];
  }

  @Get('catalogs')
  @ApiOperation({ operationId: 'listMetaCompanyCatalogs', summary: 'Lista catalogos comerciales activos.' })
  @ApiOkResponse({ type: MetaCompanyCatalogResponseDto })
  public async listCatalogs(): Promise<MetaCompanyCatalogResponseDto> { return this.metaCompanyService.listCatalogs(); }

  @Get('catalogs/all')
  @UseGuards(MetaCompanyCatalogManagementGuard)
  @ApiOperation({ operationId: 'listAllMetaCompanyCatalogs', summary: 'Lista todos los catalogos comerciales.' })
  @ApiOkResponse({ type: MetaCompanyCatalogResponseDto })
  public async listAllCatalogs(): Promise<MetaCompanyCatalogResponseDto> { return this.metaCompanyService.listCatalogs(true); }

  @Get('capabilities')
  @ApiOperation({ operationId: 'getMetaCompanyCapabilities', summary: 'Obtiene las acciones habilitadas para la sesion.' })
  @ApiOkResponse({ type: MetaCompanyCapabilitiesResponseDto })
  public async getCapabilities(@Req() request: AuthenticatedRequest): Promise<MetaCompanyCapabilitiesResponseDto> {
    const userId = requireAuthenticatedUserId(request);
    const [canManageCatalogs, canManageGoals] = await Promise.all([
      this.applicationAuthorizationService.hasApplicationPermission(userId, META_COMPANY_APPLICATION_KEY, 'manage-catalogs'),
      this.applicationAuthorizationService.hasApplicationPermission(userId, META_COMPANY_APPLICATION_KEY, 'manage-goals'),
    ]);
    return { canManageCatalogs, canManageGoals };
  }

  @Post('brand-goals') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: CreateMetaCompanyBrandGoalDto }) @ApiCreatedResponse()
  public async createBrandGoal(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createBrandGoal({ period: stringValue(body.period), businessId: numberValue(body.businessId), brandId: numberValue(body.brandId), value: stringValue(body.value) }, requireAuthenticatedUserId(request)); }

  @Post('advisor-goals') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: CreateMetaCompanyAdvisorGoalDto }) @ApiCreatedResponse()
  public async createAdvisorGoal(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createAdvisorGoal({ period: stringValue(body.period), businessId: numberValue(body.businessId), brandId: body.brandId === undefined ? undefined : numberValue(body.brandId), advisorId: numberValue(body.advisorId), value: stringValue(body.value), workingDays: body.workingDays === undefined ? undefined : numberValue(body.workingDays) }, requireAuthenticatedUserId(request)); }

  @Patch('brand-goals/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: UpdateMetaCompanyGoalDto }) @ApiOkResponse()
  public async updateBrandGoal(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.updateBrandGoal(Number(id), stringValue(body.value), requireAuthenticatedUserId(request)); }

  @Patch('advisor-goals/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: UpdateMetaCompanyGoalDto }) @ApiOkResponse()
  public async updateAdvisorGoal(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.updateAdvisorGoal(Number(id), stringValue(body.value), body.workingDays === undefined ? undefined : numberValue(body.workingDays), requireAuthenticatedUserId(request)); }

  @Post('empresas') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyEmpresaDto }) @ApiCreatedResponse()
  public async createEmpresa(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createEmpresa(stringValue(body.code), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Post('brands') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyCatalogItemDto }) @ApiCreatedResponse()
  public async createBrand(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createBrand(numberValue(body.empresaId), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Post('businesses') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyCatalogItemDto }) @ApiCreatedResponse()
  public async createBusiness(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createBusiness(numberValue(body.empresaId), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Post('advisors') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyAdvisorDto }) @ApiCreatedResponse()
  public async createAdvisor(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createAdvisor({ empresaId: numberValue(body.empresaId), sourceSystem: stringValue(body.sourceSystem), externalCode: stringValue(body.externalCode), displayName: stringValue(body.displayName), kind: stringValue(body.kind) }, requireAuthenticatedUserId(request)); }
}

function stringValue(value: unknown): string { if (typeof value !== 'string') throw new BadRequestException('La solicitud es invalida.'); return value; }
function numberValue(value: unknown): number { if (typeof value !== 'number') throw new BadRequestException('La solicitud es invalida.'); return value; }
function requireAuthenticatedUserId(request: AuthenticatedRequest): string { if (request.authenticatedUser === undefined) throw new Error('El guard de sesion no adjunto un usuario autenticado.'); return request.authenticatedUser.id; }
