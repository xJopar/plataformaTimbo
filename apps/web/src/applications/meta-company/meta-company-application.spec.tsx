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

describe('MetaCompanyApplication', () => {
  it('muestra la creación de metas y la gestión de catálogos para administrador', async () => {
    const user = userEvent.setup();
    const createMetaCompanyGoal = vi.fn().mockResolvedValue({
      id: 12,
      period: '2026-09-01',
      businessId: 3,
      businessName: 'Comercial',
      brandId: 2,
      brandName: 'Faccini',
      salespersonCode: null,
      goalType: 'Marca',
      value: '500.00',
      updatedAt: null,
    });
    const api = {
      applications: {
        listMetaCompanyGoals: vi.fn().mockResolvedValue([]),
        listMetaCompanyCatalogs: vi.fn().mockResolvedValue({
          brands: [{ id: 2, name: 'Faccini', active: true }],
          businesses: [{ id: 3, name: 'Comercial', active: true }],
        }),
        listAllMetaCompanyCatalogs: vi.fn().mockResolvedValue({
          brands: [{ id: 2, name: 'Faccini', active: true }],
          businesses: [{ id: 3, name: 'Comercial', active: true }],
        }),
        getMetaCompanyCapabilities: vi
          .fn()
          .mockResolvedValue({ canManageCatalogs: true, canManageGoals: true }),
        createMetaCompanyGoal,
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
    await user.selectOptions(screen.getByLabelText('Marca'), '2');
    await user.type(screen.getByLabelText('Valor de meta'), '500.00');
    await user.click(screen.getByRole('button', { name: 'Crear meta' }));

    await waitFor(() =>
      expect(createMetaCompanyGoal).toHaveBeenCalledWith({
        period: expect.stringMatching(/^\d{4}-\d{2}-01$/u),
        businessId: 3,
        brandId: 2,
        goalType: 'Marca',
        value: '500.00',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Gestionar marcas y negocios' }));
    expect(await screen.findByRole('heading', { name: 'Marcas y negocios' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva marca')).toBeInTheDocument();
    expect(screen.getByLabelText('Nuevo negocio')).toBeInTheDocument();
  });
});
