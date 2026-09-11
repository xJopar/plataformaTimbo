import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Api, AuthSession, AuthorizedApplication } from '../../api';
import type { ApplicationComponentProps } from '../application-component';
import { MetaCompanyApplication } from './meta-company-application';
import {
  buildBrandGoalsPath,
  buildManageMarcasPath,
  buildManageEmpresasPath,
} from './meta-company-routes';

type AdvisorGoals = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['listMetaCompanyGoals']>
>;

const application: AuthorizedApplication = {
  key: 'meta-company',
  name: 'Meta Company',
  description: 'Administración de metas comerciales.',
  launchPath: '/apps/meta-company',
  displayOrder: 2,
};

const session: AuthSession = {
  id: 'session-a',
  corporateEmail: 'persona@timbo.com.py',
  displayName: 'Persona Timbo',
  isPlatformAdministrator: false,
};

const empresa = { id: 1, code: 'TIMBO', name: 'Timbo', active: true };
const advisors = [
  {
    id: 152,
    empresaId: 1,
    sourceSystem: 'SAP_B1',
    externalCode: '152',
    displayName: 'Luis Reguera',
    kind: 'PERSON' as const,
    active: true,
  },
  {
    id: 153,
    empresaId: 1,
    sourceSystem: 'SAP_B1',
    externalCode: '153',
    displayName: 'Mirna Ovelar',
    kind: 'PERSON' as const,
    active: true,
  },
];
const brands = [{ id: 2, empresaId: 1, name: 'Facchini', active: true }];

interface CatalogFixtures {
  advisors?: typeof advisors;
  brands?: typeof brands;
  businesses?: { id: number; empresaId: number; name: string; active: boolean }[];
  goals?: AdvisorGoals;
}

function renderMetaCompany(
  pathname: string,
  overrides: Partial<ApplicationComponentProps> = {},
  catalogFixtures: CatalogFixtures = {},
) {
  const catalogs = {
    empresas: [empresa],
    brands: catalogFixtures.brands ?? [],
    businesses: catalogFixtures.businesses ?? [],
    advisors: catalogFixtures.advisors ?? [],
  };
  const api = {
    applications: {
      listMetaCompanyCatalogs: vi.fn().mockResolvedValue(catalogs),
      listAllMetaCompanyCatalogs: vi.fn().mockResolvedValue(catalogs),
      listMetaCompanyGoals: vi.fn().mockResolvedValue(catalogFixtures.goals ?? []),
      updateMetaCompanyBrandGoal: vi.fn(),
      updateMetaCompanyAdvisorGoal: vi.fn(),
      getMetaCompanyCapabilities: vi
        .fn()
        .mockResolvedValue({ canManageCatalogs: true, canManageGoals: true }),
      createMetaCompanyAdvisor: vi.fn(),
      updateMetaCompanyAdvisor: vi.fn(),
      setMetaCompanyAdvisorActive: vi.fn(),
      createMetaCompanyEmpresa: vi.fn(),
      updateMetaCompanyEmpresa: vi.fn(),
      setMetaCompanyEmpresaActive: vi.fn(),
      createMetaCompanyBrand: vi.fn(),
      updateMetaCompanyBrand: vi.fn(),
      setMetaCompanyBrandActive: vi.fn(),
      createMetaCompanyBusiness: vi.fn(),
      updateMetaCompanyBusiness: vi.fn(),
      setMetaCompanyBusinessActive: vi.fn(),
    },
  };

  const rendered = render(
    <MetaCompanyApplication
      api={api as unknown as Api}
      application={application}
      availableApplications={[application]}
      session={session}
      pathname={pathname}
      isLoggingOut={false}
      logoutFailure={undefined}
      onNavigate={vi.fn<ApplicationComponentProps['onNavigate']>()}
      onLogout={vi.fn<ApplicationComponentProps['onLogout']>()}
      {...overrides}
    />,
  );

  return { ...rendered, api };
}

describe('MetaCompanyApplication — asesores', () => {
  it('crea un asesor desde la sección de gestión de asesores', async () => {
    const user = userEvent.setup();
    const { api } = renderMetaCompany('/apps/meta-company');
    api.applications.createMetaCompanyAdvisor.mockResolvedValue({
      id: 5,
      empresaId: 1,
      sourceSystem: 'SAP_B1',
      externalCode: '20',
      displayName: 'Nueva Asesora',
      kind: 'PERSON',
      active: true,
    });

    await user.click(await screen.findByRole('button', { name: 'Gestionar asesores' }));
    expect(await screen.findByRole('heading', { name: 'Nuevo asesor' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Empresa'), '1');
    await user.type(screen.getByLabelText('Sistema de origen'), 'SAP_B1');
    await user.type(screen.getByLabelText('Código externo'), '20');
    await user.type(screen.getByLabelText('Nombre visible'), 'Nueva Asesora');
    await user.click(screen.getByRole('button', { name: 'Agregar asesor' }));

    await waitFor(() =>
      expect(api.applications.createMetaCompanyAdvisor).toHaveBeenCalledWith({
        empresaId: 1,
        sourceSystem: 'SAP_B1',
        externalCode: '20',
        displayName: 'Nueva Asesora',
        kind: 'PERSON',
      }),
    );
  });

  it('muestra asesores reales y navega a su detalle', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<ApplicationComponentProps['onNavigate']>();
    renderMetaCompany('/apps/meta-company', { onNavigate }, { advisors });

    expect(await screen.findByRole('heading', { name: 'Luis Reguera' })).toBeInTheDocument();
    const advisorActions = screen.getAllByRole('button', { name: 'Ver metas' });
    await user.click(advisorActions[0]!);

    const currentYear = new Date().getFullYear();
    expect(onNavigate).toHaveBeenCalledWith(`/apps/meta-company/asesores/152/${currentYear}`);
  });

  it('la pantalla de detalle carga metas por marca desde la API y navega al siguiente', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<ApplicationComponentProps['onNavigate']>();
    renderMetaCompany(
      '/apps/meta-company/asesores/152/2026',
      { onNavigate },
      {
        advisors,
        goals: [
          {
            id: 35,
            period: '2026-01-01',
            businessId: 3,
            businessName: 'Comercial',
            brandId: 2,
            brandName: 'Facchini',
            salespersonCode: 152,
            advisorId: 152,
            goalType: 'Vendedor',
            value: '24944.91',
            updatedAt: null,
          },
        ],
      },
    );

    expect(await screen.findByRole('heading', { name: 'Luis Reguera' })).toBeInTheDocument();
    expect(await screen.findByText('Facchini')).toBeInTheDocument();
    expect(await screen.findByLabelText('Meta de Facchini, 01/2026 · Ene')).toHaveValue(
      '24.944,91',
    );

    await user.click(screen.getByRole('button', { name: 'Año siguiente' }));

    expect(onNavigate).toHaveBeenCalledWith('/apps/meta-company/asesores/152/2027');
  });
});

describe('MetaCompanyApplication — metas por marca', () => {
  it('ofrece la descarga de la plantilla de carga de metas', async () => {
    renderMetaCompany('/apps/meta-company');

    const templateLink = await screen.findByRole('link', { name: 'Descargar plantilla Excel' });
    expect(templateLink).toHaveAttribute('href', '/plantilla-metas-comerciales.xlsx');
    expect(templateLink).toHaveAttribute('download');
  });

  it('abre el importador Excel para quien puede gestionar metas', async () => {
    const user = userEvent.setup();
    renderMetaCompany('/apps/meta-company');

    await user.click(await screen.findByRole('button', { name: 'Importar Excel' }));

    expect(
      await screen.findByRole('heading', { name: 'Importar metas desde Excel' }),
    ).toBeInTheDocument();
  });

  it('el tab de marca navega a su propia ruta', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<ApplicationComponentProps['onNavigate']>();
    renderMetaCompany('/apps/meta-company', { onNavigate });

    await user.click(await screen.findByRole('button', { name: 'Por marca' }));
    expect(onNavigate).toHaveBeenCalledWith(buildBrandGoalsPath(application.launchPath));
  });

  it('despliega una marca y actualiza una meta real, en la ruta de metas por marca', async () => {
    const user = userEvent.setup();
    const { api } = renderMetaCompany(
      buildBrandGoalsPath(application.launchPath),
      {},
      {
        brands,
        goals: [
          {
            id: 42,
            period: '2026-01-01',
            businessId: 5,
            businessName: 'Comercial',
            brandId: 2,
            brandName: 'Facchini',
            salespersonCode: null,
            advisorId: null,
            goalType: 'Marca',
            value: '100.00',
            updatedAt: null,
          },
        ],
      },
    );
    api.applications.updateMetaCompanyBrandGoal.mockResolvedValue({ value: '99999.00' });

    expect(await screen.findByRole('heading', { name: 'Metas por marca' })).toBeInTheDocument();

    await user.click(await screen.findByText('Facchini'));
    await user.click(await screen.findByText('01/2026 · Ene'));
    const monthInput = await screen.findByLabelText('Meta de Comercial, 01/2026 · Ene');
    await user.clear(monthInput);
    await user.type(monthInput, '99999.00');
    await user.click(within(monthInput.closest('form')!).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(api.applications.updateMetaCompanyBrandGoal).toHaveBeenCalledWith(42, '99999.00'),
    );
  });
});

describe('MetaCompanyApplication — gestión de empresas', () => {
  it('crea, edita y desactiva una empresa desde su ruta propia', async () => {
    const user = userEvent.setup();
    const { api } = renderMetaCompany(buildManageEmpresasPath(application.launchPath));
    api.applications.createMetaCompanyEmpresa.mockResolvedValue({
      id: 2,
      code: 'FIXIT',
      name: 'Fixit',
      active: true,
    });
    api.applications.updateMetaCompanyEmpresa.mockResolvedValue({
      id: 1,
      code: 'TIMBO',
      name: 'Timbo SA',
      active: true,
    });
    api.applications.setMetaCompanyEmpresaActive.mockResolvedValue({
      id: 1,
      code: 'TIMBO',
      name: 'Timbo',
      active: false,
    });

    expect(await screen.findByRole('heading', { name: 'Empresas' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Código'), 'FIXIT');
    await user.type(screen.getByLabelText('Nombre'), 'Fixit');
    await user.click(screen.getByRole('button', { name: 'Agregar empresa' }));
    await waitFor(() =>
      expect(api.applications.createMetaCompanyEmpresa).toHaveBeenCalledWith({
        code: 'FIXIT',
        name: 'Fixit',
      }),
    );

    const row = (await screen.findByText('Timbo')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Editar' }));
    expect(await screen.findByRole('heading', { name: 'Editar empresa' })).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Nombre');
    await user.clear(nameInput);
    await user.type(nameInput, 'Timbo SA');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(api.applications.updateMetaCompanyEmpresa).toHaveBeenCalledWith(1, {
        code: 'TIMBO',
        name: 'Timbo SA',
      }),
    );

    await user.click(within(row).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() =>
      expect(api.applications.setMetaCompanyEmpresaActive).toHaveBeenCalledWith(1, false),
    );
  });
});

describe('MetaCompanyApplication — gestión de marcas', () => {
  it('crea una marca desde su ruta propia (mismo componente compartido con Negocio)', async () => {
    const user = userEvent.setup();
    const { api } = renderMetaCompany(buildManageMarcasPath(application.launchPath));
    api.applications.createMetaCompanyBrand.mockResolvedValue({
      id: 3,
      empresaId: 1,
      name: 'Fixit',
      active: true,
    });

    expect(await screen.findByRole('heading', { name: 'Marcas' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombre'), 'Fixit');
    await user.click(screen.getByRole('button', { name: 'Agregar marca' }));

    await waitFor(() =>
      expect(api.applications.createMetaCompanyBrand).toHaveBeenCalledWith({
        empresaId: 0,
        name: 'Fixit',
      }),
    );
  });
});
