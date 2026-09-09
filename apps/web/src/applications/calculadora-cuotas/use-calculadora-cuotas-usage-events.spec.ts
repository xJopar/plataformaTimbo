import { describe, expect, it } from 'vitest';
import { getCalculationSource } from './use-calculadora-cuotas-usage-events';

describe('getCalculationSource', () => {
  it('distingue unidades manuales, de Lista de Precios y mixtas sin incluir sus datos', () => {
    expect(getCalculationSource([{ source: 'manual' }])).toBe('manual');
    expect(getCalculationSource([{ source: 'catalog' }])).toBe('lista_precios');
    expect(getCalculationSource([{ source: 'manual' }, { source: 'catalog' }])).toBe('mixed');
  });
});
