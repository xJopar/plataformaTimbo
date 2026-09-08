import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InterestRateInfo } from './interest-rate-info';

describe('InterestRateInfo', () => {
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
});
