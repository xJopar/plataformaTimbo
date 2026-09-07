import { describe, expect, it } from 'vitest';
import { groupEquipmentRentals } from './equipment-rentals-screen';

describe('groupEquipmentRentals', () => {
  it('agrupa las tarifas por los tipos de maquinaria definidos', () => {
    expect(
      groupEquipmentRentals([
        { description: 'Pala Cargadora SYL956H', capacity: '3 M3', tariff: 'Gs. 269.500' },
        { description: 'Compactador SSR120', capacity: '12 T', tariff: 'Gs. 280.000' },
        { description: 'Equipo especial', capacity: '', tariff: 'Gs. 100.000' },
      ]),
    ).toEqual([
      {
        label: 'Pala cargadora',
        rentals: [
          { description: 'Pala Cargadora SYL956H', capacity: '3 M3', tariff: 'Gs. 269.500' },
        ],
      },
      {
        label: 'Compactador',
        rentals: [{ description: 'Compactador SSR120', capacity: '12 T', tariff: 'Gs. 280.000' }],
      },
      {
        label: 'Otros equipos',
        rentals: [{ description: 'Equipo especial', capacity: '', tariff: 'Gs. 100.000' }],
      },
    ]);
  });
});
