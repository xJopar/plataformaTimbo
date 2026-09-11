import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { MetaCompanyServiceLayerService } from './meta-company-service-layer.service';
import { MetaCompanyService } from './meta-company.service';
import { MetaCompanyServiceLayerUnavailableError } from './meta-company-service-layer.errors';

describe('MetaCompanyService', () => {
  const serviceLayerService = {
    listEmpresas: jest.fn(),
    listBrands: jest.fn(),
    listBusinesses: jest.fn(),
    listAdvisors: jest.fn(),
    updateEmpresa: jest.fn(),
  };
  const auditEventsService = { append: jest.fn().mockResolvedValue(undefined) };
  const operationalLogger = { logMetaCompanyCatalogPartialFailure: jest.fn() };
  const requestContext = { getRequestId: jest.fn().mockReturnValue('request-1') };
  const platformPrisma = {
    $transaction: jest.fn((callback: (transactionClient: unknown) => unknown) => callback({})),
  };
  const service = new MetaCompanyService(
    platformPrisma as unknown as PrismaService,
    auditEventsService as unknown as AuditEventsService,
    serviceLayerService as unknown as MetaCompanyServiceLayerService,
    operationalLogger as never,
    requestContext as never,
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
      brandCatalogAvailable: true,
      empresas: [{ id: 1, code: 'TIMBO', name: 'Timbo', active: true }],
      brands: [],
      businesses: [{ id: 2, empresaId: 1, name: 'Comercial', active: true }],
      advisors: [],
    });
    expect(serviceLayerService.listEmpresas).toHaveBeenCalledWith(false);
  });

  it('mantiene disponibles los demas catalogos si Service Layer no entrega marcas', async () => {
    serviceLayerService.listEmpresas.mockResolvedValue([
      { idEmpresa: 1, codigo: 'TIMBO', empresa: 'Timbo', activo: true },
    ]);
    serviceLayerService.listBrands.mockRejectedValue(
      new MetaCompanyServiceLayerUnavailableError('Service Layer no disponible.'),
    );
    serviceLayerService.listBusinesses.mockResolvedValue([]);
    serviceLayerService.listAdvisors.mockResolvedValue([
      {
        idAsesor: 45,
        idEmpresa: 1,
        idSap: 152,
        nombre: 'Luis Reguera',
        tipo: 'PERSON',
        activo: true,
      },
    ]);

    await expect(service.listCatalogs()).resolves.toEqual({
      brandCatalogAvailable: false,
      empresas: [{ id: 1, code: 'TIMBO', name: 'Timbo', active: true }],
      brands: [],
      businesses: [],
      advisors: [
        {
          id: 45,
          empresaId: 1,
          sourceSystem: 'SAP_B1',
          externalCode: '152',
          displayName: 'Luis Reguera',
          kind: 'PERSON',
          active: true,
        },
      ],
    });
    expect(operationalLogger.logMetaCompanyCatalogPartialFailure).toHaveBeenCalledWith(
      expect.any(MetaCompanyServiceLayerUnavailableError),
      { catalog: 'brands', requestId: 'request-1' },
    );
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
