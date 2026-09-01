import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { MetaCompanyPrismaService } from './meta-company-prisma.service';
import { MetaCompanyService } from './meta-company.service';

describe('MetaCompanyService', () => {
  const secondaryPrisma = {
    commercialEmpresa: { findMany: jest.fn() },
    commercialBrand: { findMany: jest.fn() },
    commercialBusiness: { findMany: jest.fn() },
    commercialAdvisor: { findMany: jest.fn() },
  };
  const service = new MetaCompanyService(
    secondaryPrisma as unknown as MetaCompanyPrismaService,
    {} as PrismaService,
    {} as AuditEventsService,
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
});
