import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { MetaCompanyServiceLayerService } from './meta-company-service-layer.service';
import { MetaCompanyService } from './meta-company.service';

describe('MetaCompanyService', () => {
  const serviceLayerService = {
    listEmpresas: jest.fn(),
    listBrands: jest.fn(),
    listBusinesses: jest.fn(),
    listAdvisors: jest.fn(),
    listBrandGoals: jest.fn(),
    listAdvisorGoals: jest.fn(),
    updateEmpresa: jest.fn(),
  };
  const auditEventsService = { append: jest.fn().mockResolvedValue(undefined) };
  const platformPrisma = {
    $transaction: jest.fn((callback: (transactionClient: unknown) => unknown) => callback({})),
  };
  const service = new MetaCompanyService(
    platformPrisma as unknown as PrismaService,
    auditEventsService as unknown as AuditEventsService,
    serviceLayerService as unknown as MetaCompanyServiceLayerService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista las dimensiones comerciales exclusivamente desde Service Layer', async () => {
    serviceLayerService.listEmpresas.mockResolvedValue([
      { idEmpresa: 1, codigo: 'TIMBO', empresa: 'Timbo', activo: true },
    ]);
    serviceLayerService.listBrands.mockResolvedValue([]);
    serviceLayerService.listBusinesses.mockResolvedValue([
      { idNegocio: 2, idEmpresa: 1, codigo: 'COM', negocio: 'Comercial', activo: true },
    ]);
    serviceLayerService.listAdvisors.mockResolvedValue([]);

    await expect(service.listCatalogs()).resolves.toEqual({
      empresas: [{ id: 1, code: 'TIMBO', name: 'Timbo', active: true }],
      brands: [],
      businesses: [{ id: 2, empresaId: 1, name: 'Comercial', active: true }],
      advisors: [],
    });
    expect(serviceLayerService.listEmpresas).toHaveBeenCalledWith(false);
  });

  it('consulta las metas por el año solicitado en Service Layer', async () => {
    serviceLayerService.listEmpresas.mockResolvedValue([]);
    serviceLayerService.listBrands.mockResolvedValue([]);
    serviceLayerService.listBusinesses.mockResolvedValue([
      { idNegocio: 3, idEmpresa: 1, codigo: 'COM', negocio: 'Comercial', activo: true },
    ]);
    serviceLayerService.listAdvisors.mockResolvedValue([]);
    serviceLayerService.listBrandGoals.mockResolvedValue([]);
    serviceLayerService.listAdvisorGoals.mockResolvedValue([]);

    await expect(service.listGoals('2025')).resolves.toEqual({ brandGoals: [], advisorGoals: [] });
    expect(serviceLayerService.listBrandGoals).toHaveBeenCalledWith(3, 2025);
    expect(serviceLayerService.listAdvisorGoals).toHaveBeenCalledWith(3, 2025);
  });

  it('actualiza una empresa en Service Layer y conserva la auditoría de plataforma', async () => {
    serviceLayerService.updateEmpresa.mockResolvedValue({
      idEmpresa: 1,
      codigo: 'TIMBO',
      empresa: 'Timbo SA',
      activo: true,
    });

    await expect(service.updateEmpresa(1, 'timbo', 'Timbo SA', 'user-1')).resolves.toEqual({
      id: 1,
      code: 'TIMBO',
      name: 'Timbo SA',
      active: true,
    });
    expect(serviceLayerService.updateEmpresa).toHaveBeenCalledWith(1, 'TIMBO', 'Timbo SA');
    expect(auditEventsService.append).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ eventName: 'meta-company.empresa_updated' }),
    );
  });
});
