import { describe, expect, it } from 'vitest';
import { parseMetaCompanyExcelImport } from './meta-company-excel-import';
import type { Catalogs } from './meta-company-types';

const catalogs: Catalogs = {
  brandCatalogAvailable: true,
  empresas: [{ id: 1, code: 'TIMBO', name: 'Timbo', active: true }],
  advisors: [
    {
      id: 61,
      empresaId: 1,
      sourceSystem: 'SAP_B1',
      externalCode: '1',
      displayName: 'Luis Aguilera',
      kind: 'PERSON',
      active: true,
    },
  ],
  brands: [{ id: 23, empresaId: 1, name: 'BAIC', active: true }],
  businesses: [{ id: 3, empresaId: 1, name: 'Comercial', active: true }],
};

describe('parseMetaCompanyExcelImport', () => {
  it('convierte las dos hojas operativas a metas canónicas', () => {
    const result = parseMetaCompanyExcelImport(
      new Map([
        [
          'Metas Timbo',
          [
            ['Fecha', 'id_vendedor', 'Vendedor', 'Marca', 'Meta', 'negocio'],
            ['2026-01-01', '1', 'Luis Aguilera', 'BAIC', '12.220,50', 'Comercial'],
          ],
        ],
        [
          'Metas Marcas',
          [
            ['Fecha', 'Marca', 'Meta', 'Días hábiles', 'negocio'],
            ['01/01/2026', 'BAIC', '38.237,42', '22', 'Comercial'],
          ],
        ],
      ]),
      catalogs,
    );

    expect(result.errors).toEqual([]);
    expect(result.operations).toEqual([
      {
        kind: 'advisor',
        source: 'Metas Timbo, fila 2',
        input: {
          period: '2026-01-01',
          businessId: 3,
          brandId: 23,
          advisorId: 61,
          value: '12220.50',
        },
      },
      {
        kind: 'brand',
        source: 'Metas Marcas, fila 2',
        input: {
          period: '2026-01-01',
          businessId: 3,
          brandId: 23,
          value: '38237.42',
          workingDays: 22,
        },
      },
    ]);
  });

  it('rechaza una fila cuyo asesor no puede resolverse', () => {
    const result = parseMetaCompanyExcelImport(
      new Map([
        [
          'Metas Timbo',
          [
            ['Fecha', 'id_vendedor', 'Meta', 'negocio'],
            ['2026-01-01', '999', '1.000,00', 'Comercial'],
          ],
        ],
      ]),
      catalogs,
    );

    expect(result.operations).toEqual([]);
    expect(result.errors).toEqual([
      {
        source: 'Metas Timbo, fila 2',
        message: 'No encontramos un asesor activo con ese id_vendedor.',
      },
    ]);
  });
});
