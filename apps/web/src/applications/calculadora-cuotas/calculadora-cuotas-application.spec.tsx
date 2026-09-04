import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Api, AuthSession, AuthorizedApplication } from '../../api';
import type { ApplicationComponentProps } from '../application-component';
import { CalculadoraCuotasApplication } from './calculadora-cuotas-application';

const application: AuthorizedApplication = {
  key: 'calculadora-cuotas',
  name: 'Calculadora de Cuotas',
  description: 'Calcula planes de financiación.',
  launchPath: '/apps/calculadora-cuotas',
  displayOrder: 1,
};

const session: AuthSession = {
  id: 'session-a',
  corporateEmail: 'persona@timbo.com.py',
  displayName: 'Persona Timbo',
  isPlatformAdministrator: false,
};

function renderCalculator(): void {
  const api = {
    applications: {
      listListaPreciosVehicles: vi.fn().mockResolvedValue([]),
    },
  } as unknown as Api;

  render(
    <CalculadoraCuotasApplication
      api={api}
      application={application}
      availableApplications={[application]}
      session={session}
      pathname={application.launchPath}
      isLoggingOut={false}
      logoutFailure={undefined}
      onNavigate={vi.fn<ApplicationComponentProps['onNavigate']>()}
      onLogout={vi.fn<ApplicationComponentProps['onLogout']>()}
    />,
  );
}

describe('CalculadoraCuotasApplication', () => {
  it('vuelve a Unidades desde Modalidad después de calcular un plan', async () => {
    const user = userEvent.setup();
    renderCalculator();

    await user.click(screen.getByRole('tab', { name: 'Manual' }));
    await user.type(screen.getByLabelText('Descripción'), 'Unidad de prueba');
    await user.type(screen.getByLabelText('Precio (USD)'), '100000');
    expect(screen.getByLabelText('Precio (USD)')).toHaveValue('100.000');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    await user.click(screen.getByRole('button', { name: 'Continuar con financiación' }));
    await user.click(screen.getByRole('button', { name: /^Normal/ }));
    await user.click(screen.getByRole('button', { name: 'Continuar con condiciones' }));
    expect(screen.getByLabelText('Porcentaje')).toHaveValue('20');
    await user.click(screen.getByRole('button', { name: 'Calcular plan' }));
    await user.click(screen.getByRole('button', { name: 'Cambiar condiciones' }));
    await user.click(screen.getByRole('button', { name: 'Cambiar modalidad' }));
    await user.click(screen.getByRole('button', { name: 'Volver a unidades' }));

    expect(screen.getByRole('heading', { name: 'Agregar unidad' })).toBeInTheDocument();
  });
});
