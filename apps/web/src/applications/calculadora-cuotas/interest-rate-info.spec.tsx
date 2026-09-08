import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InterestRateInfo } from './interest-rate-info';

describe('InterestRateInfo', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra el mensaje de la promoción al hacer clic en el ícono de información', () => {
    render(<InterestRateInfo />);

    const button = screen.getByRole('button', { name: 'Información sobre editar interés' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Cambiá la tasa para aplicar una promo vigente.',
    );

    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('cierra el mensaje a los cinco segundos', () => {
    vi.useFakeTimers();
    render(<InterestRateInfo />);

    fireEvent.click(screen.getByRole('button', { name: 'Información sobre editar interés' }));
    act(() => vi.advanceTimersByTime(5_000));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('cierra el mensaje cuando se interactúa fuera del componente', () => {
    render(<InterestRateInfo />);
    fireEvent.click(screen.getByRole('button', { name: 'Información sobre editar interés' }));

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
