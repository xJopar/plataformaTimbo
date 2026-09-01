import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActorType } from '../../generated/prisma/client';
import { CommercialGoalType, Prisma } from '../../generated/meta-company-prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { type AuditEventName } from '../audit-events/audit-event-catalog';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { MetaCompanyPrismaService } from './meta-company-prisma.service';

type MetaCompanyAuditEventName = Extract<AuditEventName, `meta-company.${string}`>;
type MetaCompanyTargetType = 'commercial_goal' | 'commercial_brand' | 'commercial_business';

export interface CreateGoalInput {
  period: string;
  businessId: number;
  brandId: number;
  salespersonCode?: number;
  goalType: 'Marca' | 'Vendedor';
  value: string;
  actorUserId: string;
}

@Injectable()
export class MetaCompanyService {
  public constructor(
    private readonly prisma: MetaCompanyPrismaService,
    private readonly platformPrisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
  ) {}

  public async listCatalogs(includeInactive = false) {
    const where = includeInactive ? {} : { active: true };
    const [brands, businesses] = await Promise.all([
      this.prisma.commercialBrand.findMany({ where, orderBy: { name: 'asc' } }),
      this.prisma.commercialBusiness.findMany({ where, orderBy: { name: 'asc' } }),
    ]);
    return { brands, businesses };
  }

  public async listGoals(period?: string) {
    const selectedPeriod = period === undefined ? undefined : parsePeriod(period);
    return this.prisma.commercialSalesGoal.findMany({
      where: selectedPeriod === undefined ? undefined : { period: selectedPeriod },
      include: { brand: true, business: true },
      orderBy: [
        { business: { name: 'asc' } },
        { salespersonCode: 'asc' },
        { brand: { name: 'asc' } },
      ],
    });
  }

  public async createGoal(input: CreateGoalInput) {
    const data = this.normalizeGoalInput(input);
    const [brand, business] = await Promise.all([
      this.prisma.commercialBrand.findFirst({ where: { id: data.brandId, active: true } }),
      this.prisma.commercialBusiness.findFirst({ where: { id: data.businessId, active: true } }),
    ]);
    if (brand === null || business === null) {
      throw new BadRequestException('La marca y el negocio deben existir y estar activos.');
    }

    const duplicate = await this.prisma.commercialSalesGoal.findFirst({
      where: data,
      select: { id: true },
    });
    if (duplicate !== null) throw new ConflictException('Ya existe una meta con ese alcance.');

    const goal = await this.prisma.commercialSalesGoal.create({
      data,
      include: { brand: true, business: true },
    });
    await this.appendAuditEvent(
      'meta-company.goal_created',
      input.actorUserId,
      'commercial_goal',
      goal.id,
    );
    return goal;
  }

  public async updateGoal(id: number, value: string, actorUserId: string) {
    const goalId = parseId(id);
    const normalizedValue = parseValue(value);
    const result = await this.prisma.commercialSalesGoal.updateMany({
      where: { id: goalId },
      data: { value: normalizedValue, updatedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('No se encontró la meta solicitada.');

    const goal = await this.prisma.commercialSalesGoal.findUniqueOrThrow({
      where: { id: goalId },
      include: { brand: true, business: true },
    });
    await this.appendAuditEvent(
      'meta-company.goal_updated',
      actorUserId,
      'commercial_goal',
      goal.id,
    );
    return goal;
  }

  public async createBrand(name: string, actorUserId: string) {
    const brand = await this.prisma.commercialBrand.create({
      data: { name: normalizeName(name, 100) },
    });
    await this.appendAuditEvent(
      'meta-company.brand_created',
      actorUserId,
      'commercial_brand',
      brand.id,
    );
    return brand;
  }

  public async createBusiness(name: string, actorUserId: string) {
    const business = await this.prisma.commercialBusiness.create({
      data: { name: normalizeName(name, 50) },
    });
    await this.appendAuditEvent(
      'meta-company.business_created',
      actorUserId,
      'commercial_business',
      business.id,
    );
    return business;
  }

  public async setBrandActive(id: number, active: boolean, actorUserId: string): Promise<void> {
    await this.setCatalogActive('brand', id, active, actorUserId);
  }

  public async setBusinessActive(id: number, active: boolean, actorUserId: string): Promise<void> {
    await this.setCatalogActive('business', id, active, actorUserId);
  }

  private async setCatalogActive(
    kind: 'brand' | 'business',
    id: number,
    active: boolean,
    actorUserId: string,
  ): Promise<void> {
    const catalogId = parseId(id);
    const result =
      kind === 'brand'
        ? await this.prisma.commercialBrand.updateMany({
            where: { id: catalogId, active: !active },
            data: { active },
          })
        : await this.prisma.commercialBusiness.updateMany({
            where: { id: catalogId, active: !active },
            data: { active },
          });

    if (result.count === 0) {
      const existing =
        kind === 'brand'
          ? await this.prisma.commercialBrand.findUnique({
              where: { id: catalogId },
              select: { active: true },
            })
          : await this.prisma.commercialBusiness.findUnique({
              where: { id: catalogId },
              select: { active: true },
            });
      if (existing === null) throw new NotFoundException('No se encontró el catálogo solicitado.');
      throw new ConflictException('El catálogo ya se encuentra en el estado solicitado.');
    }

    await this.appendAuditEvent(
      active
        ? kind === 'brand'
          ? 'meta-company.brand_reactivated'
          : 'meta-company.business_reactivated'
        : kind === 'brand'
          ? 'meta-company.brand_deactivated'
          : 'meta-company.business_deactivated',
      actorUserId,
      kind === 'brand' ? 'commercial_brand' : 'commercial_business',
      catalogId,
    );
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

  private normalizeGoalInput(input: CreateGoalInput) {
    const goalType =
      input.goalType === 'Marca' ? CommercialGoalType.BRAND : CommercialGoalType.SALESPERSON;
    const salespersonCode = input.salespersonCode;
    if (
      (goalType === CommercialGoalType.BRAND && salespersonCode !== undefined) ||
      (goalType === CommercialGoalType.SALESPERSON && !Number.isSafeInteger(salespersonCode))
    ) {
      throw new BadRequestException('El asesor no coincide con el tipo de meta indicado.');
    }
    return {
      period: parsePeriod(input.period),
      businessId: parseId(input.businessId),
      brandId: parseId(input.brandId),
      salespersonCode: goalType === CommercialGoalType.BRAND ? null : salespersonCode,
      goalType,
      value: parseValue(input.value),
    };
  }
}

function parsePeriod(value: string): Date {
  if (!/^\d{4}-\d{2}-01$/.test(value)) {
    throw new BadRequestException('El período debe ser el primer día de un mes.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) throw new BadRequestException('El período no es válido.');
  return date;
}

function parseId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException('El identificador es inválido.');
  }
  return value;
}

function parseValue(value: string): Prisma.Decimal {
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(value)) {
    throw new BadRequestException(
      'La meta debe ser un decimal no negativo con hasta dos decimales.',
    );
  }
  return new Prisma.Decimal(value);
}

function normalizeName(value: string, maximumLength: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new BadRequestException('El nombre indicado no es válido.');
  }
  return normalized;
}
