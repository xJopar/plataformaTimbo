import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Api, AuthSession, AuthorizedApplication } from '../../api';
import type { ApplicationComponentProps } from '../application-component';
import { MetaCompanyApplication } from './meta-company-application';

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
const brand = { id: 2, empresaId: 1, name: 'Faccini', active: true };
const business = { id: 3, empresaId: 1, name: 'Comercial', active: true };
const advisor = {
  id: 4,
  empresaId: 1,
  sourceSystem: 'SAP_B1',
  externalCode: '10',
  displayName: 'Hugo Baez',
  kind: 'PERSON' as const,
  active: true,
};

describe('MetaCompanyApplication', () => {
  it('crea una meta por marca contra el endpoint de metas por marca', async () => {
    const user = userEvent.setup();
    const createMetaCompanyBrandGoal = vi.fn().mockResolvedValue({
      id: 12,
      period: '2026-09-01',
      businessId: 3,
      businessName: 'Comercial',
      brandId: 2,
      brandName: 'Faccini',
      value: '500.00',
      updatedAt: null,
    });
    const api = {
      applications: {
        listMetaCompanyGoals: vi.fn().mockResolvedValue([]),
        listMetaCompanyCatalogs: vi.fn().mockResolvedValue({
          empresas: [empresa],
          brands: [brand],
          businesses: [business],
          advisors: [advisor],
        }),
        listAllMetaCompanyCatalogs: vi.fn().mockResolvedValue({
          empresas: [empresa],
          brands: [brand],
          businesses: [business],
          advisors: [advisor],
        }),
        getMetaCompanyCapabilities: vi
          .fn()
          .mockResolvedValue({ canManageCatalogs: true, canManageGoals: true }),
        createMetaCompanyBrandGoal,
      },
    } as unknown as Api;

    render(
      <MetaCompanyApplication
        api={api}
        application={application}
        availableApplications={[application]}
        session={session}
        pathname="/apps/meta-company"
        isLoggingOut={false}
        logoutFailure={undefined}
        onNavigate={vi.fn<ApplicationComponentProps['onNavigate']>()}
        onLogout={vi.fn<ApplicationComponentProps['onLogout']>()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Nueva meta' }));
    await user.selectOptions(screen.getByLabelText('Negocio'), '3');
    await user.selectOptions(screen.getByLabelText(/^Marca/), '2');
    await user.type(screen.getByLabelText('Valor de meta'), '500.00');
    await user.click(screen.getByRole('button', { name: 'Crear meta' }));

    await waitFor(() =>
      expect(createMetaCompanyBrandGoal).toHaveBeenCalledWith({
        period: expect.stringMatching(/^\d{4}-\d{2}-01$/u),
        businessId: 3,
        brandId: 2,
        value: '500.00',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Gestionar marcas y negocios' }));
    expect(await screen.findByRole('heading', { name: 'Marcas y negocios' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva marca')).toBeInTheDocument();
    expect(screen.getByLabelText('Nuevo negocio')).toBeInTheDocument();
  });

  it('crea un asesor desde la sección de gestión de asesores', async () => {
    const user = userEvent.setup();
    const createMetaCompanyAdvisor = vi.fn().mockResolvedValue({ ...advisor, id: 5 });
    const api = {
      applications: {
        listMetaCompanyGoals: vi.fn().mockResolvedValue([]),
        listMetaCompanyCatalogs: vi.fn().mockResolvedValue({
          empresas: [empresa],
          brands: [brand],
          businesses: [business],
          advisors: [advisor],
        }),
        listAllMetaCompanyCatalogs: vi.fn().mockResolvedValue({
          empresas: [empresa],
          brands: [brand],
          businesses: [business],
          advisors: [advisor],
        }),
        getMetaCompanyCapabilities: vi
          .fn()
          .mockResolvedValue({ canManageCatalogs: true, canManageGoals: true }),
        createMetaCompanyAdvisor,
      },
    } as unknown as Api;

    render(
      <MetaCompanyApplication
        api={api}
        application={application}
        availableApplications={[application]}
        session={session}
        pathname="/apps/meta-company"
        isLoggingOut={false}
        logoutFailure={undefined}
        onNavigate={vi.fn<ApplicationComponentProps['onNavigate']>()}
        onLogout={vi.fn<ApplicationComponentProps['onLogout']>()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Gestionar asesores' }));
    expect(await screen.findByRole('heading', { name: 'Nuevo asesor' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Empresa'), '1');
    await user.type(screen.getByLabelText('Sistema de origen'), 'SAP_B1');
    await user.type(screen.getByLabelText('Código externo'), '20');
    await user.type(screen.getByLabelText('Nombre visible'), 'Nueva Asesora');
    await user.click(screen.getByRole('button', { name: 'Agregar asesor' }));

    await waitFor(() =>
      expect(createMetaCompanyAdvisor).toHaveBeenCalledWith({
        empresaId: 1,
        sourceSystem: 'SAP_B1',
        externalCode: '20',
        displayName: 'Nueva Asesora',
        kind: 'PERSON',
      }),
    );
  });
});
