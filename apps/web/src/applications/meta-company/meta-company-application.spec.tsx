import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Api, AuthSession, AuthorizedApplication } from '../../api';
import type { ApplicationComponentProps } from '../application-component';
import { MetaCompanyApplication } from './meta-company-application';
import * as metaCompanyMockData from './meta-company-mock-data';

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

function renderMetaCompany(pathname: string, overrides: Partial<ApplicationComponentProps> = {}) {
  const api = {
    applications: {
      listMetaCompanyCatalogs: vi.fn().mockResolvedValue({
        empresas: [empresa],
        brands: [],
        businesses: [],
        advisors: [],
      }),
      listAllMetaCompanyCatalogs: vi.fn().mockResolvedValue({
        empresas: [empresa],
        brands: [],
        businesses: [],
        advisors: [],
      }),
      getMetaCompanyCapabilities: vi
        .fn()
        .mockResolvedValue({ canManageCatalogs: true, canManageGoals: true }),
      createMetaCompanyAdvisor: vi.fn(),
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

describe('MetaCompanyApplication', () => {
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
    const saveSpy = vi.spyOn(metaCompanyMockData, 'saveAdvisorMonthGoal');
    renderMetaCompany('/apps/meta-company');

    const luisButton = await screen.findByRole('button', { name: 'Ver detalle de Luis Reguera' });
    const luisDetails = luisButton.closest('details');
    expect(luisDetails).not.toBeNull();
    await user.click(within(luisDetails!).getByText('›'));
    expect(luisDetails).toHaveProperty('open', true);
    expect(within(luisDetails!).getByText('01/2026 · Ene')).toBeInTheDocument();

    const mirnaButton = await screen.findByRole('button', { name: 'Ver detalle de Mirna Ovelar' });
    const mirnaDetails = mirnaButton.closest('details');
    expect(mirnaDetails).not.toBeNull();
    await user.click(within(mirnaDetails!).getByText('›'));

    const emptyMonthInput = within(mirnaDetails!).getByLabelText('Meta de 03/2026 · Mar');
    await user.type(emptyMonthInput, '150000.00');
    await user.click(
      within(emptyMonthInput.closest('form')!).getByRole('button', { name: 'Guardar' }),
    );

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(153, '2026-03-01', '150000.00'),
    );
  });

  it('el clic en el nombre del asesor navega al detalle sin desplegar el acordeón', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn<ApplicationComponentProps['onNavigate']>();
    renderMetaCompany('/apps/meta-company', { onNavigate });

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
    renderMetaCompany('/apps/meta-company/asesores/152/2026', { onNavigate });

    expect(await screen.findByRole('heading', { name: 'Luis Reguera' })).toBeInTheDocument();
    expect(screen.getByLabelText('Meta de 01/2026 · Ene')).toHaveValue('291419.00');

    await user.click(screen.getByRole('button', { name: 'Año siguiente' }));

    expect(onNavigate).toHaveBeenCalledWith('/apps/meta-company/asesores/152/2027');
  });
});
