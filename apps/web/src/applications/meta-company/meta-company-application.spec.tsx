import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Api, AuthSession, AuthorizedApplication } from '../../api';
import type { ApplicationComponentProps } from '../application-component';
import { MetaCompanyApplication } from './meta-company-application';
import * as metaCompanyMockData from './meta-company-mock-data';
import { buildBrandGoalsPath, buildManageMarcasPath, buildManageEmpresasPath } from './meta-company-routes';

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

  it('despliega el acordeón de un asesor y guarda un mes sin meta cargada', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(metaCompanyMockData, 'saveMonthGoal');
    renderMetaCompany('/apps/meta-company', {}, { advisors });

    const luisButton = await screen.findByRole('button', { name: 'Ver detalle de Luis Reguera' });
    const luisDetails = luisButton.closest('details');
    expect(luisDetails).not.toBeNull();
    await user.click(within(luisDetails!).getByText('›'));
    expect(luisDetails).toHaveProperty('open', true);
    expect(await within(luisDetails!).findByText('01/2026 · Ene')).toBeInTheDocument();

    const mirnaButton = await screen.findByRole('button', { name: 'Ver detalle de Mirna Ovelar' });
    const mirnaDetails = mirnaButton.closest('details');
    expect(mirnaDetails).not.toBeNull();
    await user.click(within(mirnaDetails!).getByText('›'));

    const emptyMonthInput = await within(mirnaDetails!).findByLabelText('Meta de 03/2026 · Mar');
    await user.type(emptyMonthInput, '150000.00');
    await user.click(
      within(emptyMonthInput.closest('form')!).getByRole('button', { name: 'Guardar' }),
    );

    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('advisor', 153, '2026-03-01', '150000.00'));
  });

  it('el clic en el nombre del asesor navega al detalle sin desplegar el acordeón', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<ApplicationComponentProps['onNavigate']>();
    renderMetaCompany('/apps/meta-company', { onNavigate }, { advisors });

    const luisButton = await screen.findByRole('button', { name: 'Ver detalle de Luis Reguera' });
    const luisDetails = luisButton.closest('details');
    await user.click(luisButton);

    const currentYear = new Date().getFullYear();
    expect(onNavigate).toHaveBeenCalledWith(`/apps/meta-company/asesores/152/${currentYear}`);
    expect(luisDetails).toHaveProperty('open', false);
  });

  it('la pantalla de detalle carga un año por URL y navega al siguiente', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<ApplicationComponentProps['onNavigate']>();
    renderMetaCompany('/apps/meta-company/asesores/152/2026', { onNavigate }, { advisors });

    expect(await screen.findByRole('heading', { name: 'Luis Reguera' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Meta de 01/2026 · Ene')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Año siguiente' }));

    expect(onNavigate).toHaveBeenCalledWith('/apps/meta-company/asesores/152/2027');
  });
});

describe('MetaCompanyApplication — metas por marca', () => {
  it('el tab de marca navega a su propia ruta', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<ApplicationComponentProps['onNavigate']>();
    renderMetaCompany('/apps/meta-company', { onNavigate });

    await user.click(await screen.findByRole('button', { name: 'Por marca' }));
    expect(onNavigate).toHaveBeenCalledWith(buildBrandGoalsPath(application.launchPath));
  });

  it('despliega una marca y guarda un mes, en la ruta de metas por marca', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(metaCompanyMockData, 'saveMonthGoal');
    renderMetaCompany(buildBrandGoalsPath(application.launchPath), {}, { brands });

    expect(await screen.findByRole('heading', { name: 'Metas por marca' })).toBeInTheDocument();

    await user.click(await screen.findByText('Facchini'));
    const monthInput = await screen.findByLabelText('Meta de 01/2026 · Ene');
    await user.type(monthInput, '99999.00');
    await user.click(within(monthInput.closest('form')!).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('brand', 2, '2026-01-01', '99999.00'));
  });
});

describe('MetaCompanyApplication — gestión de empresas', () => {
  it('crea, edita y desactiva una empresa desde su ruta propia', async () => {
    const user = userEvent.setup();
    const { api } = renderMetaCompany(buildManageEmpresasPath(application.launchPath));
    api.applications.createMetaCompanyEmpresa.mockResolvedValue({ id: 2, code: 'FIXIT', name: 'Fixit', active: true });
    api.applications.updateMetaCompanyEmpresa.mockResolvedValue({ id: 1, code: 'TIMBO', name: 'Timbo SA', active: true });
    api.applications.setMetaCompanyEmpresaActive.mockResolvedValue({ id: 1, code: 'TIMBO', name: 'Timbo', active: false });

    expect(await screen.findByRole('heading', { name: 'Empresas' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Código'), 'FIXIT');
    await user.type(screen.getByLabelText('Nombre'), 'Fixit');
    await user.click(screen.getByRole('button', { name: 'Agregar empresa' }));
    await waitFor(() =>
      expect(api.applications.createMetaCompanyEmpresa).toHaveBeenCalledWith({ code: 'FIXIT', name: 'Fixit' }),
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
    await waitFor(() => expect(api.applications.setMetaCompanyEmpresaActive).toHaveBeenCalledWith(1, false));
  });
});

describe('MetaCompanyApplication — gestión de marcas', () => {
  it('crea una marca desde su ruta propia (mismo componente compartido con Negocio)', async () => {
    const user = userEvent.setup();
    const { api } = renderMetaCompany(buildManageMarcasPath(application.launchPath));
    api.applications.createMetaCompanyBrand.mockResolvedValue({ id: 3, empresaId: 1, name: 'Fixit', active: true });

    expect(await screen.findByRole('heading', { name: 'Marcas' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Empresa'), '1');
    await user.type(screen.getByLabelText('Nombre'), 'Fixit');
    await user.click(screen.getByRole('button', { name: 'Agregar marca' }));

    await waitFor(() =>
      expect(api.applications.createMetaCompanyBrand).toHaveBeenCalledWith({ empresaId: 1, name: 'Fixit' }),
    );
  });
});
