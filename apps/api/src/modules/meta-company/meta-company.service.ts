import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, Prisma } from '../../generated/prisma/client';
import { CommercialAdvisorKind, type Prisma as MetaPrisma } from '../../generated/meta-company-prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { type AuditEventName } from '../audit-events/audit-event-catalog';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { MetaCompanyPrismaService } from './meta-company-prisma.service';

type MetaCompanyAuditEventName = Extract<AuditEventName, `meta-company.${string}`>;
type MetaCompanyTargetType =
  | 'commercial_empresa'
  | 'commercial_brand'
  | 'commercial_business'
  | 'commercial_advisor'
  | 'commercial_brand_goal'
  | 'commercial_advisor_goal';

@Injectable()
export class MetaCompanyService {
  public constructor(
    private readonly prisma: MetaCompanyPrismaService,
    private readonly platformPrisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
  ) {}

  public async listCatalogs(includeInactive = false) {
    const active = includeInactive ? {} : { active: true };
    const [empresas, brands, businesses, advisors] = await Promise.all([
      this.prisma.commercialEmpresa.findMany({ where: active, orderBy: { name: 'asc' } }),
      this.prisma.commercialBrand.findMany({ where: active, orderBy: { name: 'asc' } }),
      this.prisma.commercialBusiness.findMany({ where: active, orderBy: { name: 'asc' } }),
      this.prisma.commercialAdvisor.findMany({ where: active, orderBy: { displayName: 'asc' } }),
    ]);
    return { empresas, brands, businesses, advisors };
  }

  public async listGoals(period?: string, empresaId?: number) {
    const selectedPeriod = period === undefined ? undefined : parsePeriod(period);
    const selectedEmpresaId = empresaId === undefined ? undefined : parseId(empresaId);
    const where = {
      ...(selectedPeriod === undefined ? {} : { period: selectedPeriod }),
      ...(selectedEmpresaId === undefined ? {} : { business: { empresaId: selectedEmpresaId } }),
    };
    const [brandGoals, advisorGoals] = await Promise.all([
      this.prisma.commercialBrandGoal.findMany({
        where,
        include: { brand: true, business: true },
        orderBy: [{ business: { name: 'asc' } }, { brand: { name: 'asc' } }],
      }),
      this.prisma.commercialAdvisorGoal.findMany({
        where,
        include: { advisor: true, brand: true, business: true },
        orderBy: [{ business: { name: 'asc' } }, { advisor: { displayName: 'asc' } }],
      }),
    ]);
    return { brandGoals, advisorGoals };
  }

  public async createEmpresa(code: string, name: string, actorUserId: string) {
    const empresa = await this.prisma.commercialEmpresa.create({
      data: { code: normalizeCode(code), name: normalizeName(name, 100) },
    });
    await this.appendAuditEvent('meta-company.empresa_created', actorUserId, 'commercial_empresa', empresa.id);
    return empresa;
  }

  public async createBrand(empresaId: number, name: string, actorUserId: string) {
    const brand = await this.prisma.commercialBrand.create({
      data: { empresaId: await this.requireActiveEmpresa(empresaId), name: normalizeName(name, 100) },
    });
    await this.appendAuditEvent('meta-company.brand_created', actorUserId, 'commercial_brand', brand.id);
    return brand;
  }

  public async createBusiness(empresaId: number, name: string, actorUserId: string) {
    const business = await this.prisma.commercialBusiness.create({
      data: { empresaId: await this.requireActiveEmpresa(empresaId), name: normalizeName(name, 50) },
    });
    await this.appendAuditEvent('meta-company.business_created', actorUserId, 'commercial_business', business.id);
    return business;
  }

  public async createAdvisor(
    input: { empresaId: number; sourceSystem: string; externalCode: string; displayName: string; kind: string },
    actorUserId: string,
  ) {
    const kind = parseAdvisorKind(input.kind);
    const advisor = await this.prisma.commercialAdvisor.create({
      data: {
        empresaId: await this.requireActiveEmpresa(input.empresaId),
        sourceSystem: normalizeName(input.sourceSystem, 30),
        externalCode: normalizeName(input.externalCode, 100),
        displayName: normalizeName(input.displayName, 150),
        kind,
      },
    });
    await this.appendAuditEvent('meta-company.advisor_created', actorUserId, 'commercial_advisor', advisor.id);
    return advisor;
  }

  public async updateAdvisor(
    id: number,
    input: { empresaId: number; sourceSystem: string; externalCode: string; displayName: string; kind: string },
    actorUserId: string,
  ) {
    const advisor = await this.prisma.commercialAdvisor.update({
      where: { id: parseId(id) },
      data: {
        empresaId: await this.requireActiveEmpresa(input.empresaId),
        sourceSystem: normalizeName(input.sourceSystem, 30),
        externalCode: normalizeName(input.externalCode, 100),
        displayName: normalizeName(input.displayName, 150),
        kind: parseAdvisorKind(input.kind),
      },
    }).catch(throwAdvisorNotFound);
    await this.appendAuditEvent('meta-company.advisor_updated', actorUserId, 'commercial_advisor', advisor.id);
    return advisor;
  }

  public async setAdvisorActive(id: number, active: boolean, actorUserId: string) {
    const advisor = await this.prisma.commercialAdvisor.update({
      where: { id: parseId(id) },
      data: { active },
    }).catch(throwAdvisorNotFound);
    await this.appendAuditEvent(
      active ? 'meta-company.advisor_reactivated' : 'meta-company.advisor_deactivated',
      actorUserId,
      'commercial_advisor',
      advisor.id,
    );
    return advisor;
  }

  public async createBrandGoal(input: { period: string; businessId: number; brandId: number; value: string }, actorUserId: string) {
    const data = { period: parsePeriod(input.period), businessId: parseId(input.businessId), brandId: parseId(input.brandId), value: parseValue(input.value) };
    await this.requireScope(data.businessId, data.brandId);
    await this.ensureNoBrandGoal(data);
    const goal = await this.prisma.commercialBrandGoal.create({ data, include: { brand: true, business: true } });
    await this.appendAuditEvent('meta-company.goal_created', actorUserId, 'commercial_brand_goal', goal.id);
    return goal;
  }

  public async createAdvisorGoal(input: { period: string; businessId: number; brandId?: number; advisorId: number; value: string; workingDays?: number }, actorUserId: string) {
    const data = {
      period: parsePeriod(input.period), businessId: parseId(input.businessId), brandId: input.brandId === undefined ? null : parseId(input.brandId),
      advisorId: parseId(input.advisorId), value: parseValue(input.value), workingDays: input.workingDays === undefined ? null : parseWorkingDays(input.workingDays),
    };
    await this.requireScope(data.businessId, data.brandId, data.advisorId);
    const duplicate = await this.prisma.commercialAdvisorGoal.findFirst({ where: { period: data.period, businessId: data.businessId, brandId: data.brandId, advisorId: data.advisorId }, select: { id: true } });
    if (duplicate !== null) throw new ConflictException('Ya existe una meta con ese alcance.');
    const goal = await this.prisma.commercialAdvisorGoal.create({ data, include: { advisor: true, brand: true, business: true } });
    await this.appendAuditEvent('meta-company.goal_created', actorUserId, 'commercial_advisor_goal', goal.id);
    return goal;
  }

  public async updateBrandGoal(id: number, value: string, actorUserId: string) {
    const goal = await this.prisma.commercialBrandGoal.update({ where: { id: parseId(id) }, data: { value: parseValue(value), updatedAt: new Date() }, include: { brand: true, business: true } }).catch(throwGoalNotFound);
    await this.appendAuditEvent('meta-company.goal_updated', actorUserId, 'commercial_brand_goal', goal.id);
    return goal;
  }

  public async updateAdvisorGoal(id: number, value: string, workingDays: number | undefined, actorUserId: string) {
    const goal = await this.prisma.commercialAdvisorGoal.update({ where: { id: parseId(id) }, data: { value: parseValue(value), ...(workingDays === undefined ? {} : { workingDays: parseWorkingDays(workingDays) }), updatedAt: new Date() }, include: { advisor: true, brand: true, business: true } }).catch(throwGoalNotFound);
    await this.appendAuditEvent('meta-company.goal_updated', actorUserId, 'commercial_advisor_goal', goal.id);
    return goal;
  }

  private async requireActiveEmpresa(id: number): Promise<number> {
    const empresaId = parseId(id);
    if (await this.prisma.commercialEmpresa.findFirst({ where: { id: empresaId, active: true }, select: { id: true } }) === null) throw new BadRequestException('La empresa debe existir y estar activa.');
    return empresaId;
  }

  private async requireScope(businessId: number, brandId?: number | null, advisorId?: number) {
    const [business, brand, advisor] = await Promise.all([
      this.prisma.commercialBusiness.findFirst({ where: { id: businessId, active: true }, select: { empresaId: true } }),
      brandId === undefined || brandId === null ? null : this.prisma.commercialBrand.findFirst({ where: { id: brandId, active: true }, select: { empresaId: true } }),
      advisorId === undefined ? null : this.prisma.commercialAdvisor.findFirst({ where: { id: advisorId, active: true }, select: { empresaId: true } }),
    ]);
    if (business === null || (brandId !== undefined && brandId !== null && brand === null) || (advisorId !== undefined && advisor === null) || (brand !== null && brand.empresaId !== business.empresaId) || (advisor !== null && advisor.empresaId !== business.empresaId)) throw new BadRequestException('El negocio, la marca y el asesor deben estar activos y pertenecer a la misma empresa.');
  }

  private async ensureNoBrandGoal(data: MetaPrisma.CommercialBrandGoalUncheckedCreateInput) {
    if (await this.prisma.commercialBrandGoal.findFirst({ where: { period: data.period, businessId: data.businessId, brandId: data.brandId }, select: { id: true } }) !== null) throw new ConflictException('Ya existe una meta con ese alcance.');
  }

  private async appendAuditEvent(eventName: MetaCompanyAuditEventName, actorUserId: string, targetType: MetaCompanyTargetType, targetId: number): Promise<void> {
    await this.platformPrisma.$transaction((transactionClient) => this.auditEventsService.append(transactionClient, { eventName, actor: { actorType: AuditActorType.USER, actorUserId }, target: { targetType, targetId: String(targetId) } }));
  }
}

function throwGoalNotFound(): never { throw new NotFoundException('No se encontro la meta solicitada.'); }
function throwAdvisorNotFound(): never { throw new NotFoundException('No se encontro el asesor solicitado.'); }
function parsePeriod(value: string): Date { if (!/^\d{4}-\d{2}-01$/.test(value)) throw new BadRequestException('El periodo debe ser el primer dia de un mes.'); const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.valueOf())) throw new BadRequestException('El periodo no es valido.'); return date; }
function parseId(value: number): number { if (!Number.isSafeInteger(value) || value <= 0) throw new BadRequestException('El identificador es invalido.'); return value; }
function parseValue(value: string): Prisma.Decimal { if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(value)) throw new BadRequestException('La meta debe ser un decimal no negativo con hasta dos decimales.'); return new Prisma.Decimal(value); }
function parseWorkingDays(value: number): number { if (!Number.isSafeInteger(value) || value <= 0) throw new BadRequestException('Los dias habiles deben ser un entero positivo.'); return value; }
function normalizeName(value: string, maximumLength: number): string { const normalized = value.trim(); if (normalized.length === 0 || normalized.length > maximumLength) throw new BadRequestException('El nombre indicado no es valido.'); return normalized; }
function normalizeCode(value: string): string { const code = normalizeName(value, 30).toUpperCase(); if (!/^[A-Z0-9_]+$/.test(code)) throw new BadRequestException('El codigo solo admite letras, numeros y guion bajo.'); return code; }
function parseAdvisorKind(value: string): CommercialAdvisorKind { if (value !== CommercialAdvisorKind.PERSON && value !== CommercialAdvisorKind.SALES_CHANNEL) throw new BadRequestException('El tipo de asesor no es valido.'); return value; }
