import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditActorType } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { type AuditEventName } from '../audit-events/audit-event-catalog';
import { AuditEventsService } from '../audit-events/audit-events.service';
import {
  MetaCompanyServiceLayerService,
  type ServiceLayerAdvisor,
  type ServiceLayerBrand,
  type ServiceLayerBusiness,
  type ServiceLayerEmpresa,
  type ServiceLayerGoal,
} from './meta-company-service-layer.service';

type MetaCompanyAuditEventName = Extract<AuditEventName, `meta-company.${string}`>;
type MetaCompanyTargetType =
  | 'commercial_empresa'
  | 'commercial_brand'
  | 'commercial_business'
  | 'commercial_advisor'
  | 'commercial_brand_goal'
  | 'commercial_advisor_goal';

export interface MetaCompanyCatalogs {
  empresas: { id: number; code: string; name: string; active: boolean }[];
  brands: { id: number; empresaId: number; name: string; active: boolean }[];
  businesses: { id: number; empresaId: number; name: string; active: boolean }[];
  advisors: {
    id: number;
    empresaId: number;
    sourceSystem: string;
    externalCode: string;
    displayName: string;
    kind: 'PERSON' | 'SALES_CHANNEL';
    active: boolean;
  }[];
}

interface BrandGoalWithRelations {
  id: number;
  period: Date;
  businessId: number;
  brandId: number;
  value: { toFixed(digits: number): string };
  workingDays: number | null;
  updatedAt: Date | null;
  business: { name: string };
  brand: { name: string };
}

interface AdvisorGoalWithRelations {
  id: number;
  period: Date;
  businessId: number;
  brandId: number | null;
  advisorId: number;
  value: { toFixed(digits: number): string };
  workingDays: number | null;
  updatedAt: Date | null;
  business: { name: string };
  brand: { name: string } | null;
  advisor: { externalCode: string; displayName: string };
}

interface AdvisorInput {
  empresaId: number;
  sourceSystem: string;
  externalCode: string;
  displayName: string;
  kind: string;
}

interface BrandGoalInput {
  period: string;
  businessId: number;
  brandId: number;
  value: string;
  workingDays?: number;
}

interface AdvisorGoalInput {
  period: string;
  businessId: number;
  brandId?: number;
  advisorId: number;
  value: string;
  workingDays?: number;
}

@Injectable()
export class MetaCompanyService {
  public constructor(
    private readonly platformPrisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
    private readonly serviceLayerService: MetaCompanyServiceLayerService,
  ) {}

  public async listCatalogs(includeInactive = false): Promise<MetaCompanyCatalogs> {
    const [empresas, brands, businesses, advisors] = await Promise.all([
      this.serviceLayerService.listEmpresas(includeInactive),
      this.serviceLayerService.listBrands(includeInactive),
      this.serviceLayerService.listBusinesses(includeInactive),
      this.serviceLayerService.listAdvisors(includeInactive),
    ]);
    return {
      empresas: empresas.map(mapEmpresa),
      brands: brands.map(mapBrand),
      businesses: businesses.map(mapBusiness),
      advisors: advisors.map(mapAdvisor),
    };
  }

  public async listGoals(period?: string, empresaId?: number) {
    const year = period === undefined ? undefined : parsePeriod(period).getUTCFullYear();
    const catalogs = await this.listCatalogs(true);
    const businesses = catalogs.businesses.filter(
      (business) => empresaId === undefined || business.empresaId === parseId(empresaId),
    );
    const [brandGoalGroups, advisorGoalGroups] = await Promise.all([
      Promise.all(
        businesses.map((business) => this.serviceLayerService.listBrandGoals(business.id, year)),
      ),
      Promise.all(
        businesses.map((business) => this.serviceLayerService.listAdvisorGoals(business.id, year)),
      ),
    ]);

    return {
      brandGoals: brandGoalGroups.flat().map((goal) => mapBrandGoal(goal, catalogs)),
      advisorGoals: advisorGoalGroups.flat().map((goal) => mapAdvisorGoal(goal, catalogs)),
    };
  }

  public async createEmpresa(code: string, name: string, actorUserId: string) {
    const empresa = await this.serviceLayerService.createEmpresa(
      normalizeCode(code),
      normalizeName(name, 100),
    );
    await this.appendAuditEvent(
      'meta-company.empresa_created',
      actorUserId,
      'commercial_empresa',
      empresa.idEmpresa,
    );
    return mapEmpresa(empresa);
  }

  public async updateEmpresa(id: number, code: string, name: string, actorUserId: string) {
    const empresa = await this.serviceLayerService.updateEmpresa(
      parseId(id),
      normalizeCode(code),
      normalizeName(name, 100),
    );
    await this.appendAuditEvent(
      'meta-company.empresa_updated',
      actorUserId,
      'commercial_empresa',
      empresa.idEmpresa,
    );
    return mapEmpresa(empresa);
  }

  public async setEmpresaActive(id: number, active: boolean, actorUserId: string) {
    const empresa = await this.serviceLayerService.setEmpresaActive(parseId(id), active);
    await this.appendAuditEvent(
      active ? 'meta-company.empresa_reactivated' : 'meta-company.empresa_deactivated',
      actorUserId,
      'commercial_empresa',
      empresa.idEmpresa,
    );
    return mapEmpresa(empresa);
  }

  public async createBrand(_empresaId: number, name: string, actorUserId: string) {
    const normalizedName = normalizeName(name, 100);
    const brand = await this.serviceLayerService.createBrand(
      normalizeCode(normalizedName),
      normalizedName,
    );
    await this.appendAuditEvent(
      'meta-company.brand_created',
      actorUserId,
      'commercial_brand',
      brand.idMarca,
    );
    return mapBrand(brand);
  }

  public async updateBrand(id: number, _empresaId: number, name: string, actorUserId: string) {
    const normalizedName = normalizeName(name, 100);
    const brand = await this.serviceLayerService.updateBrand(
      parseId(id),
      normalizeCode(normalizedName),
      normalizedName,
    );
    await this.appendAuditEvent(
      'meta-company.brand_updated',
      actorUserId,
      'commercial_brand',
      brand.idMarca,
    );
    return mapBrand(brand);
  }

  public async setBrandActive(id: number, active: boolean, actorUserId: string) {
    const brand = await this.serviceLayerService.setBrandActive(parseId(id), active);
    await this.appendAuditEvent(
      active ? 'meta-company.brand_reactivated' : 'meta-company.brand_deactivated',
      actorUserId,
      'commercial_brand',
      brand.idMarca,
    );
    return mapBrand(brand);
  }

  public async createBusiness(empresaId: number, name: string, actorUserId: string) {
    const normalizedName = normalizeName(name, 50);
    const business = await this.serviceLayerService.createBusiness(
      parseId(empresaId),
      normalizeCode(normalizedName),
      normalizedName,
    );
    await this.appendAuditEvent(
      'meta-company.business_created',
      actorUserId,
      'commercial_business',
      business.idNegocio,
    );
    return mapBusiness(business);
  }

  public async updateBusiness(id: number, empresaId: number, name: string, actorUserId: string) {
    const normalizedName = normalizeName(name, 50);
    const business = await this.serviceLayerService.updateBusiness(
      parseId(id),
      parseId(empresaId),
      normalizeCode(normalizedName),
      normalizedName,
    );
    await this.appendAuditEvent(
      'meta-company.business_updated',
      actorUserId,
      'commercial_business',
      business.idNegocio,
    );
    return mapBusiness(business);
  }

  public async setBusinessActive(id: number, active: boolean, actorUserId: string) {
    const business = await this.serviceLayerService.setBusinessActive(parseId(id), active);
    await this.appendAuditEvent(
      active ? 'meta-company.business_reactivated' : 'meta-company.business_deactivated',
      actorUserId,
      'commercial_business',
      business.idNegocio,
    );
    return mapBusiness(business);
  }

  public async createAdvisor(input: AdvisorInput, actorUserId: string) {
    const advisor = await this.serviceLayerService.createAdvisor(normalizeAdvisorInput(input));
    await this.appendAuditEvent(
      'meta-company.advisor_created',
      actorUserId,
      'commercial_advisor',
      advisor.idAsesor,
    );
    return mapAdvisor(advisor);
  }

  public async updateAdvisor(id: number, input: AdvisorInput, actorUserId: string) {
    const advisor = await this.serviceLayerService.updateAdvisor(
      parseId(id),
      normalizeAdvisorInput(input),
    );
    await this.appendAuditEvent(
      'meta-company.advisor_updated',
      actorUserId,
      'commercial_advisor',
      advisor.idAsesor,
    );
    return mapAdvisor(advisor);
  }

  public async setAdvisorActive(id: number, active: boolean, actorUserId: string) {
    const advisor = await this.serviceLayerService.setAdvisorActive(parseId(id), active);
    await this.appendAuditEvent(
      active ? 'meta-company.advisor_reactivated' : 'meta-company.advisor_deactivated',
      actorUserId,
      'commercial_advisor',
      advisor.idAsesor,
    );
    return mapAdvisor(advisor);
  }

  public async createBrandGoal(input: BrandGoalInput, actorUserId: string) {
    const goal = await this.serviceLayerService.createBrandGoal(normalizeBrandGoalInput(input));
    const mappedGoal = mapBrandGoal(goal, await this.listCatalogs(true));
    await this.appendAuditEvent(
      'meta-company.goal_created',
      actorUserId,
      'commercial_brand_goal',
      mappedGoal.id,
    );
    return mappedGoal;
  }

  public async createAdvisorGoal(input: AdvisorGoalInput, actorUserId: string) {
    const goal = await this.serviceLayerService.createAdvisorGoal(normalizeAdvisorGoalInput(input));
    const mappedGoal = mapAdvisorGoal(goal, await this.listCatalogs(true));
    await this.appendAuditEvent(
      'meta-company.goal_created',
      actorUserId,
      'commercial_advisor_goal',
      mappedGoal.id,
    );
    return mappedGoal;
  }

  public async updateBrandGoal(
    id: number,
    value: string,
    workingDays: number | undefined,
    actorUserId: string,
  ) {
    const goal = await this.serviceLayerService.updateBrandGoal(
      parseId(id),
      normalizeGoalValue(value),
      workingDays === undefined ? undefined : parseWorkingDays(workingDays),
    );
    const mappedGoal = mapBrandGoal(goal, await this.listCatalogs(true));
    await this.appendAuditEvent(
      'meta-company.goal_updated',
      actorUserId,
      'commercial_brand_goal',
      mappedGoal.id,
    );
    return mappedGoal;
  }

  public async updateAdvisorGoal(
    id: number,
    value: string,
    workingDays: number | undefined,
    actorUserId: string,
  ) {
    const goal = await this.serviceLayerService.updateAdvisorGoal(
      parseId(id),
      normalizeGoalValue(value),
      workingDays === undefined ? undefined : parseWorkingDays(workingDays),
    );
    const mappedGoal = mapAdvisorGoal(goal, await this.listCatalogs(true));
    await this.appendAuditEvent(
      'meta-company.goal_updated',
      actorUserId,
      'commercial_advisor_goal',
      mappedGoal.id,
    );
    return mappedGoal;
  }

  private async appendAuditEvent(
    eventName: MetaCompanyAuditEventName,
    actorUserId: string,
    targetType: MetaCompanyTargetType,
    targetId: number,
  ): Promise<void> {
    await this.platformPrisma.$transaction((transactionClient) =>
      this.auditEventsService.append(transactionClient, {
        eventName,
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType, targetId: String(targetId) },
      }),
    );
  }
}

function mapEmpresa(empresa: ServiceLayerEmpresa) {
  return {
    id: empresa.idEmpresa,
    code: empresa.codigo,
    name: empresa.empresa,
    active: empresa.activo,
  };
}
function mapBrand(brand: ServiceLayerBrand) {
  return { id: brand.idMarca, empresaId: 0, name: brand.marca, active: brand.activo };
}
function mapBusiness(business: ServiceLayerBusiness) {
  return {
    id: business.idNegocio,
    empresaId: business.idEmpresa,
    name: business.negocio,
    active: business.activo,
  };
}
function mapAdvisor(advisor: ServiceLayerAdvisor) {
  return {
    id: advisor.idAsesor,
    empresaId: advisor.idEmpresa,
    sourceSystem: 'SAP_B1',
    externalCode: String(advisor.idSap),
    displayName: advisor.nombre,
    kind: advisor.tipo,
    active: advisor.activo,
  };
}
function mapBrandGoal(
  goal: ServiceLayerGoal,
  catalogs: MetaCompanyCatalogs,
): BrandGoalWithRelations {
  const business = findCatalog(catalogs.businesses, goal.idNegocio, 'negocio');
  const brand = findCatalog(catalogs.brands, goal.idMarca, 'marca');
  return {
    id: goal.id,
    period: periodToDate(goal.periodo),
    businessId: goal.idNegocio,
    brandId: goal.idMarca ?? 0,
    value: goalValue(goal.meta),
    workingDays: goal.diasHabiles,
    updatedAt: null,
    business: { name: business.name },
    brand: { name: brand.name },
  };
}
function mapAdvisorGoal(
  goal: ServiceLayerGoal,
  catalogs: MetaCompanyCatalogs,
): AdvisorGoalWithRelations {
  const business = findCatalog(catalogs.businesses, goal.idNegocio, 'negocio');
  const advisor = findCatalog(catalogs.advisors, goal.idAsesor, 'asesor');
  const brand = goal.idMarca === null ? null : findCatalog(catalogs.brands, goal.idMarca, 'marca');
  return {
    id: goal.id,
    period: periodToDate(goal.periodo),
    businessId: goal.idNegocio,
    brandId: goal.idMarca,
    advisorId: goal.idAsesor ?? 0,
    value: goalValue(goal.meta),
    workingDays: goal.diasHabiles,
    updatedAt: null,
    business: { name: business.name },
    brand: brand === null ? null : { name: brand.name },
    advisor: { externalCode: advisor.externalCode, displayName: advisor.displayName },
  };
}
function findCatalog<T extends { id: number }>(items: T[], id: number | null, label: string): T {
  const item = id === null ? undefined : items.find((candidate) => candidate.id === id);
  if (item === undefined)
    throw new BadRequestException(`Service Layer devolvio una ${label} inexistente.`);
  return item;
}
function goalValue(value: string) {
  return { toFixed: () => value };
}
function normalizeAdvisorInput(input: AdvisorInput) {
  const idSap = parseSapSalespersonCode(input.externalCode);
  if (input.sourceSystem.trim() !== 'SAP_B1')
    throw new BadRequestException('El sistema de origen del asesor debe ser SAP_B1.');
  return {
    empresaId: parseId(input.empresaId),
    idSap,
    nombre: normalizeName(input.displayName, 150),
    tipo: parseAdvisorKind(input.kind),
  };
}
function normalizeBrandGoalInput(input: BrandGoalInput) {
  return {
    periodo: periodToNumber(input.period),
    idNegocio: parseId(input.businessId),
    idMarca: parseId(input.brandId),
    meta: normalizeGoalValue(input.value),
    diasHabiles: input.workingDays === undefined ? undefined : parseWorkingDays(input.workingDays),
  };
}
function normalizeAdvisorGoalInput(input: AdvisorGoalInput) {
  return {
    periodo: periodToNumber(input.period),
    idNegocio: parseId(input.businessId),
    idMarca: input.brandId === undefined ? null : parseId(input.brandId),
    idAsesor: parseId(input.advisorId),
    meta: normalizeGoalValue(input.value),
    diasHabiles: input.workingDays === undefined ? undefined : parseWorkingDays(input.workingDays),
  };
}
function parsePeriod(value: string): Date {
  if (!/^\d{4}-\d{2}-01$/.test(value))
    throw new BadRequestException('El periodo debe ser el primer dia de un mes.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) throw new BadRequestException('El periodo no es valido.');
  return date;
}
function periodToNumber(value: string): number {
  const date = parsePeriod(value);
  return date.getUTCFullYear() * 100 + date.getUTCMonth() + 1;
}
function periodToDate(value: number): Date {
  const year = Math.floor(value / 100);
  const month = value % 100;
  if (month < 1 || month > 12)
    throw new BadRequestException('Service Layer devolvio un periodo invalido.');
  return new Date(Date.UTC(year, month - 1, 1));
}
function parseId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new BadRequestException('El identificador es invalido.');
  return value;
}
function normalizeGoalValue(value: string): string {
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(value))
    throw new BadRequestException(
      'La meta debe ser un decimal no negativo con hasta dos decimales.',
    );
  return value;
}
function parseWorkingDays(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new BadRequestException('Los dias habiles deben ser un entero positivo.');
  return value;
}
function normalizeName(value: string, maximumLength: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength)
    throw new BadRequestException('El nombre indicado no es valido.');
  return normalized;
}
function normalizeCode(value: string): string {
  const code = normalizeName(value, 30)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (code === '')
    throw new BadRequestException('El codigo solo admite letras, numeros y guion bajo.');
  return code;
}
function parseAdvisorKind(value: string): 'PERSON' | 'SALES_CHANNEL' {
  if (value === 'PERSON' || value === 'SALES_CHANNEL') return value;
  throw new BadRequestException('El tipo de asesor es invalido.');
}
function parseSapSalespersonCode(value: string): number {
  if (!/^\d+$/.test(value)) throw new BadRequestException('El codigo SAP del asesor es invalido.');
  return parseId(Number(value));
}
