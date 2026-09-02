import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { MetaCompanyPrismaService } from './meta-company-prisma.service';
import { MetaCompanyService } from './meta-company.service';

describe('MetaCompanyService', () => {
  const secondaryPrisma = {
    commercialEmpresa: { findMany: jest.fn(), update: jest.fn() },
    commercialBrand: { findMany: jest.fn(), update: jest.fn() },
    commercialBusiness: { findMany: jest.fn() },
    commercialAdvisor: { findMany: jest.fn() },
  };
  const auditEventsService = { append: jest.fn().mockResolvedValue(undefined) };
  const platformPrisma = { $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({})) };
  const service = new MetaCompanyService(
    secondaryPrisma as unknown as MetaCompanyPrismaService,
    platformPrisma as unknown as PrismaService,
    auditEventsService as unknown as AuditEventsService,
  );

  it('lista las dimensiones activas del espacio comercial', async () => {
    secondaryPrisma.commercialEmpresa.findMany.mockResolvedValue([{ id: 1, name: 'Timbo' }]);
    secondaryPrisma.commercialBrand.findMany.mockResolvedValue([]);
    secondaryPrisma.commercialBusiness.findMany.mockResolvedValue([{ id: 2, name: 'Comercial' }]);
    secondaryPrisma.commercialAdvisor.findMany.mockResolvedValue([]);

    await expect(service.listCatalogs()).resolves.toEqual({
      empresas: [{ id: 1, name: 'Timbo' }],
      brands: [],
      businesses: [{ id: 2, name: 'Comercial' }],
      advisors: [],
    });
    expect(secondaryPrisma.commercialEmpresa.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  });

  it('actualiza una empresa y audita el evento correspondiente', async () => {
    secondaryPrisma.commercialEmpresa.update.mockResolvedValue({ id: 1, code: 'TIMBO', name: 'Timbo SA', active: true });

    await expect(service.updateEmpresa(1, 'timbo', 'Timbo SA', 'user-1')).resolves.toEqual({
      id: 1,
      code: 'TIMBO',
      name: 'Timbo SA',
      active: true,
    });
    expect(secondaryPrisma.commercialEmpresa.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { code: 'TIMBO', name: 'Timbo SA' },
    });
    expect(auditEventsService.append).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventName: 'meta-company.empresa_updated' }),
    );
  });

  it('activa/desactiva una marca y audita el evento correspondiente', async () => {
    secondaryPrisma.commercialBrand.update.mockResolvedValue({ id: 2, empresaId: 1, name: 'Facchini', active: false });

    await expect(service.setBrandActive(2, false, 'user-1')).resolves.toEqual({
      id: 2,
      empresaId: 1,
      name: 'Facchini',
      active: false,
    });
    expect(secondaryPrisma.commercialBrand.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { active: false },
    });
    expect(auditEventsService.append).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventName: 'meta-company.brand_deactivated' }),
    );
  });
});
