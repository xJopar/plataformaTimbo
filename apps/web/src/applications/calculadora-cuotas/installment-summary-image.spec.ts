import { describe, expect, it } from 'vitest';
import { formatReceiptItemLabel } from './installment-summary-image';

describe('formatReceiptItemLabel', () => {
  it('muestra la descripción de una única unidad sin prefijo', () => {
    expect(formatReceiptItemLabel({ label: 'BAIC X55', quantity: 1 })).toBe('BAIC X55');
  });

  it('antepone la cantidad cuando hay más de una unidad', () => {
    expect(formatReceiptItemLabel({ label: 'BAIC X55', quantity: 2 })).toBe('2 x BAIC X55');
  });

  it('conserva una etiqueta segura cuando la descripción está vacía', () => {
    expect(formatReceiptItemLabel({ label: '   ', quantity: 4 })).toBe(
      '4 x Unidad sin descripción',
    );
  });
});
