import { AuditActorType } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { MetaCompanyPrismaService } from './meta-company-prisma.service';
import { MetaCompanyService } from './meta-company.service';

describe('MetaCompanyService', () => {
  const secondaryPrisma = {
    commercialBrand: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    commercialBusiness: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    commercialSalesGoal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const transactionClient = { auditEvent: { create: jest.fn() } };
  const platformPrisma = {
    $transaction: jest.fn(async (execute: (client: typeof transactionClient) => Promise<unknown>) =>
      execute(transactionClient),
    ),
  };
  const auditEventsService = { append: jest.fn() };
  const service = new MetaCompanyService(
    secondaryPrisma as unknown as MetaCompanyPrismaService,
    platformPrisma as unknown as PrismaService,
    auditEventsService as unknown as AuditEventsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea una meta en el proveedor temporal y registra su auditoría central', async () => {
    secondaryPrisma.commercialBrand.findFirst.mockResolvedValue({ id: 2, active: true });
    secondaryPrisma.commercialBusiness.findFirst.mockResolvedValue({ id: 3, active: true });
    secondaryPrisma.commercialSalesGoal.findFirst.mockResolvedValue(null);
    const createdGoal = {
      id: 7,
      period: new Date('2026-09-01T00:00:00.000Z'),
      businessId: 3,
      brandId: 2,
      salespersonCode: null,
      goalType: 'BRAND',
      value: { toFixed: jest.fn() },
      updatedAt: null,
      business: { name: 'Comercial' },
      brand: { name: 'Faccini' },
    };
    secondaryPrisma.commercialSalesGoal.create.mockResolvedValue(createdGoal);
    auditEventsService.append.mockResolvedValue(undefined);

    await expect(
      service.createGoal({
        period: '2026-09-01',
        businessId: 3,
        brandId: 2,
        goalType: 'Marca',
        value: '38237.42',
        actorUserId: 'administrator-a',
      }),
    ).resolves.toBe(createdGoal);

    expect(auditEventsService.append).toHaveBeenCalledWith(transactionClient, {
      eventName: 'meta-company.goal_created',
      actor: { actorType: AuditActorType.USER, actorUserId: 'administrator-a' },
      target: { targetType: 'commercial_goal', targetId: '7' },
    });
  });

  it('desactiva una marca y registra el evento central correspondiente', async () => {
    secondaryPrisma.commercialBrand.updateMany.mockResolvedValue({ count: 1 });
    auditEventsService.append.mockResolvedValue(undefined);

    await expect(service.setBrandActive(4, false, 'administrator-a')).resolves.toBeUndefined();

    expect(secondaryPrisma.commercialBrand.updateMany).toHaveBeenCalledWith({
      where: { id: 4, active: true },
      data: { active: false },
    });
    expect(auditEventsService.append).toHaveBeenCalledWith(transactionClient, {
      eventName: 'meta-company.brand_deactivated',
      actor: { actorType: AuditActorType.USER, actorUserId: 'administrator-a' },
      target: { targetType: 'commercial_brand', targetId: '4' },
    });
  });

  it('no oculta una falla de auditoría central luego de confirmar el proveedor temporal', async () => {
    secondaryPrisma.commercialBusiness.create.mockResolvedValue({ id: 8, name: 'Comercial' });
    const auditFailure = new Error('La auditoría central no está disponible.');
    auditEventsService.append.mockRejectedValue(auditFailure);

    await expect(service.createBusiness(' Comercial ', 'administrator-a')).rejects.toBe(
      auditFailure,
    );
    expect(secondaryPrisma.commercialBusiness.create).toHaveBeenCalledWith({
      data: { name: 'Comercial' },
    });
  });
});
