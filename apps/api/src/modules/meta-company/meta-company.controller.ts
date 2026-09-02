import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { APPLICATION_AUTHORIZATION_SERVICE } from '../access-profiles/access-profiles.tokens';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import { type AuthenticatedRequest, SessionAuthenticationGuard } from '../auth/session-authentication.guard';
import { META_COMPANY_APPLICATION_KEY, MetaCompanyApplicationAccessGuard } from './meta-company-application-access.guard';
import { CreateMetaCompanyAdvisorDto, CreateMetaCompanyAdvisorGoalDto, CreateMetaCompanyBrandGoalDto, CreateMetaCompanyCatalogItemDto, CreateMetaCompanyEmpresaDto, MetaCompanyAdvisorGoalListItemDto, MetaCompanyAdvisorGoalResponseDto, MetaCompanyAdvisorResponseDto, MetaCompanyBrandGoalResponseDto, MetaCompanyCapabilitiesResponseDto, MetaCompanyCatalogItemResponseDto, MetaCompanyCatalogResponseDto, MetaCompanyEmpresaResponseDto, SetMetaCompanyCatalogItemActiveDto, UpdateMetaCompanyAdvisorDto, UpdateMetaCompanyCatalogItemDto, UpdateMetaCompanyEmpresaDto, UpdateMetaCompanyGoalDto } from './dto/meta-company.dto';
import { MetaCompanyCatalogManagementGuard, MetaCompanyGoalManagementGuard } from './meta-company-permission.guards';
import { MetaCompanyService } from './meta-company.service';

@ApiTags('applications')
@Controller('applications/meta-company')
@UseGuards(SessionAuthenticationGuard, MetaCompanyApplicationAccessGuard)
export class MetaCompanyController {
  public constructor(private readonly metaCompanyService: MetaCompanyService, @Inject(APPLICATION_AUTHORIZATION_SERVICE) private readonly applicationAuthorizationService: ApplicationAuthorizationService) {}

  @Get('goals')
  @ApiOperation({ operationId: 'listMetaCompanyGoals', summary: 'Lista metas comerciales por periodo y empresa.' })
  @ApiQuery({ name: 'period', required: false })
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiOkResponse({ type: MetaCompanyAdvisorGoalListItemDto, isArray: true })
  public async listGoals(@Query('period') period?: string, @Query('empresaId') empresaId?: string): Promise<MetaCompanyAdvisorGoalListItemDto[]> {
    const goals = await this.metaCompanyService.listGoals(period, empresaId === undefined ? undefined : Number(empresaId));
    return [
      ...goals.brandGoals.map((goal) => ({ id: goal.id, period: goal.period.toISOString().slice(0, 10), businessId: goal.businessId, businessName: goal.business.name, brandId: goal.brandId, brandName: goal.brand.name, salespersonCode: null, goalType: 'Marca' as const, value: goal.value.toFixed(2), updatedAt: goal.updatedAt?.toISOString() ?? null })),
      ...goals.advisorGoals.map((goal) => ({ id: goal.id, period: goal.period.toISOString().slice(0, 10), businessId: goal.businessId, businessName: goal.business.name, brandId: goal.brandId, brandName: goal.brand?.name ?? 'No aplica', salespersonCode: Number.isSafeInteger(Number(goal.advisor.externalCode)) ? Number(goal.advisor.externalCode) : null, goalType: 'Vendedor' as const, value: goal.value.toFixed(2), updatedAt: goal.updatedAt?.toISOString() ?? null })),
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

  @Post('brand-goals') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: CreateMetaCompanyBrandGoalDto }) @ApiCreatedResponse({ type: MetaCompanyBrandGoalResponseDto })
  public async createBrandGoal(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return mapBrandGoal(await this.metaCompanyService.createBrandGoal({ period: stringValue(body.period), businessId: numberValue(body.businessId), brandId: numberValue(body.brandId), value: stringValue(body.value) }, requireAuthenticatedUserId(request))); }

  @Post('advisor-goals') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: CreateMetaCompanyAdvisorGoalDto }) @ApiCreatedResponse({ type: MetaCompanyAdvisorGoalResponseDto })
  public async createAdvisorGoal(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return mapAdvisorGoal(await this.metaCompanyService.createAdvisorGoal({ period: stringValue(body.period), businessId: numberValue(body.businessId), brandId: body.brandId === undefined ? undefined : numberValue(body.brandId), advisorId: numberValue(body.advisorId), value: stringValue(body.value), workingDays: body.workingDays === undefined ? undefined : numberValue(body.workingDays) }, requireAuthenticatedUserId(request))); }

  @Patch('brand-goals/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: UpdateMetaCompanyGoalDto }) @ApiOkResponse({ type: MetaCompanyBrandGoalResponseDto })
  public async updateBrandGoal(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return mapBrandGoal(await this.metaCompanyService.updateBrandGoal(Number(id), stringValue(body.value), requireAuthenticatedUserId(request))); }

  @Patch('advisor-goals/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyGoalManagementGuard) @ApiBody({ type: UpdateMetaCompanyGoalDto }) @ApiOkResponse({ type: MetaCompanyAdvisorGoalResponseDto })
  public async updateAdvisorGoal(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return mapAdvisorGoal(await this.metaCompanyService.updateAdvisorGoal(Number(id), stringValue(body.value), body.workingDays === undefined ? undefined : numberValue(body.workingDays), requireAuthenticatedUserId(request))); }

  @Post('empresas') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyEmpresaDto }) @ApiCreatedResponse({ type: MetaCompanyEmpresaResponseDto })
  public async createEmpresa(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createEmpresa(stringValue(body.code), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Patch('empresas/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: UpdateMetaCompanyEmpresaDto }) @ApiOkResponse({ type: MetaCompanyEmpresaResponseDto })
  public async updateEmpresa(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.updateEmpresa(Number(id), stringValue(body.code), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Patch('empresas/:id/active') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: SetMetaCompanyCatalogItemActiveDto }) @ApiOkResponse({ type: MetaCompanyEmpresaResponseDto })
  public async setEmpresaActive(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.setEmpresaActive(Number(id), booleanValue(body.active), requireAuthenticatedUserId(request)); }

  @Post('brands') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyCatalogItemDto }) @ApiCreatedResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async createBrand(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createBrand(numberValue(body.empresaId), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Patch('brands/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: UpdateMetaCompanyCatalogItemDto }) @ApiOkResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async updateBrand(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.updateBrand(Number(id), numberValue(body.empresaId), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Patch('brands/:id/active') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: SetMetaCompanyCatalogItemActiveDto }) @ApiOkResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async setBrandActive(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.setBrandActive(Number(id), booleanValue(body.active), requireAuthenticatedUserId(request)); }

  @Post('businesses') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyCatalogItemDto }) @ApiCreatedResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async createBusiness(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createBusiness(numberValue(body.empresaId), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Patch('businesses/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: UpdateMetaCompanyCatalogItemDto }) @ApiOkResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async updateBusiness(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.updateBusiness(Number(id), numberValue(body.empresaId), stringValue(body.name), requireAuthenticatedUserId(request)); }

  @Patch('businesses/:id/active') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: SetMetaCompanyCatalogItemActiveDto }) @ApiOkResponse({ type: MetaCompanyCatalogItemResponseDto })
  public async setBusinessActive(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.setBusinessActive(Number(id), booleanValue(body.active), requireAuthenticatedUserId(request)); }

  @Post('advisors') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: CreateMetaCompanyAdvisorDto }) @ApiCreatedResponse({ type: MetaCompanyAdvisorResponseDto })
  public async createAdvisor(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.metaCompanyService.createAdvisor({ empresaId: numberValue(body.empresaId), sourceSystem: stringValue(body.sourceSystem), externalCode: stringValue(body.externalCode), displayName: stringValue(body.displayName), kind: stringValue(body.kind) }, requireAuthenticatedUserId(request)); }

  @Patch('advisors/:id') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: UpdateMetaCompanyAdvisorDto }) @ApiOkResponse({ type: MetaCompanyAdvisorResponseDto })
  public async updateAdvisor(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.updateAdvisor(Number(id), { empresaId: numberValue(body.empresaId), sourceSystem: stringValue(body.sourceSystem), externalCode: stringValue(body.externalCode), displayName: stringValue(body.displayName), kind: stringValue(body.kind) }, requireAuthenticatedUserId(request)); }

  @Patch('advisors/:id/active') @UseGuards(CsrfProtectionGuard, MetaCompanyCatalogManagementGuard) @ApiBody({ type: SetMetaCompanyCatalogItemActiveDto }) @ApiOkResponse({ type: MetaCompanyAdvisorResponseDto })
  public async setAdvisorActive(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.metaCompanyService.setAdvisorActive(Number(id), booleanValue(body.active), requireAuthenticatedUserId(request)); }
}

interface BrandGoalWithRelations { id: number; period: Date; businessId: number; brandId: number; value: { toFixed(digits: number): string }; updatedAt: Date | null; business: { name: string }; brand: { name: string } }
interface AdvisorGoalWithRelations { id: number; period: Date; businessId: number; brandId: number | null; advisorId: number; value: { toFixed(digits: number): string }; workingDays: number | null; updatedAt: Date | null; business: { name: string }; brand: { name: string } | null; advisor: { externalCode: string; displayName: string } }

function mapBrandGoal(goal: BrandGoalWithRelations): MetaCompanyBrandGoalResponseDto { return { id: goal.id, period: goal.period.toISOString().slice(0, 10), businessId: goal.businessId, businessName: goal.business.name, brandId: goal.brandId, brandName: goal.brand.name, value: goal.value.toFixed(2), updatedAt: goal.updatedAt?.toISOString() ?? null }; }
function mapAdvisorGoal(goal: AdvisorGoalWithRelations): MetaCompanyAdvisorGoalResponseDto { return { id: goal.id, period: goal.period.toISOString().slice(0, 10), businessId: goal.businessId, businessName: goal.business.name, brandId: goal.brandId, brandName: goal.brand?.name ?? null, advisorId: goal.advisorId, advisorCode: goal.advisor.externalCode, advisorName: goal.advisor.displayName, value: goal.value.toFixed(2), workingDays: goal.workingDays, updatedAt: goal.updatedAt?.toISOString() ?? null }; }
function stringValue(value: unknown): string { if (typeof value !== 'string') throw new BadRequestException('La solicitud es invalida.'); return value; }
function numberValue(value: unknown): number { if (typeof value !== 'number') throw new BadRequestException('La solicitud es invalida.'); return value; }
function booleanValue(value: unknown): boolean { if (typeof value !== 'boolean') throw new BadRequestException('La solicitud es invalida.'); return value; }
function requireAuthenticatedUserId(request: AuthenticatedRequest): string { if (request.authenticatedUser === undefined) throw new Error('El guard de sesion no adjunto un usuario autenticado.'); return request.authenticatedUser.id; }
