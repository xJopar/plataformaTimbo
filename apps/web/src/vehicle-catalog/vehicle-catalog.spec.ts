import { describe, expect, it } from 'vitest';
import type { VehicleResponse } from '../api';
import {
  applyFilters,
  extractBrands,
  filterByBrand,
  filterByBrandAndModelo,
  formatPrice,
  getFilterOptions,
  getGroupKey,
  groupByMarcaModelo,
  groupByModel,
  parsePrice,
} from './vehicle-catalog';

const BASE_VEHICLE: VehicleResponse = {
  marca: '',
  modelo: '',
  anioFab: '',
  config: '',
  susp: '',
  tipoMotor: '',
  tipoCabina: '',
  tipoCaja: '',
  aire: '',
  color: '',
  km: '',
  precioLista: '',
  ubicacion: '',
  fechaSena: '',
  vendedorSena: '',
  uComentario: '',
  disponible: '',
  tipoUnidad: '',
  uso: '',
  inyeccion: '',
  altura: '',
  piso: '',
  tipo: '',
  chasis: '',
  url: '',
  codGrupo: '',
  comentario: '',
  origen: '',
  kmOrigen: '',
  fechaEntradaTaller: '',
  fechaSalidaTaller: '',
  equipamiento: '',
  laterales: '',
  diasTranscurridos: '',
  ubicacion1: '',
  aproxLlegada: '',
  disponible1: '',
  stock: '',
};

function vehicle(overrides: Partial<VehicleResponse>): VehicleResponse {
  return { ...BASE_VEHICLE, ...overrides };
}

describe('parsePrice / formatPrice', () => {
  it('parsea precios con separador de miles', () => {
    expect(parsePrice('70.300')).toBe(70300);
    expect(parsePrice('1.234,56')).toBeCloseTo(1234.56);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });

  it('formatea precios en USD o "a consultar" si no hay dato', () => {
    expect(formatPrice(70300)).toBe('USD 70.300');
    expect(formatPrice(null)).toBe('Precio a consultar');
  });
});

describe('groupByModel', () => {
  it('agrupa por marca+modelo+config+susp+tipoMotor y calcula rango de precio', () => {
    const units = [
      vehicle({
        marca: 'Sinotruk',
        modelo: 'Howo',
        config: '6x4',
        susp: 'Neumática',
        tipoMotor: 'Diésel',
        precioLista: '70.300',
        stock: 'ST-001',
        anioFab: '2024',
      }),
      vehicle({
        marca: 'Sinotruk',
        modelo: 'Howo',
        config: '6x4',
        susp: 'Neumática',
        tipoMotor: 'Diésel',
        precioLista: '75.000',
        stock: 'ST-002',
        anioFab: '2025',
      }),
    ];

    const groups = groupByModel(units);
    expect(groups.size).toBe(1);
    const [group] = groups.values();
    expect(group?.stockCount).toBe(2);
    expect(group?.precioMin).toBe(70300);
    expect(group?.precioMax).toBe(75000);
    expect(group?.anios).toEqual(['2024', '2025']);
    expect(group?.name).toBe('Sinotruk Howo 6x4 Diésel');
  });

  it('separa grupos cuando cambia cualquier campo de la clave de agrupación', () => {
    const units = [
      vehicle({ marca: 'Scania', modelo: 'R', config: '4x2', stock: 'ST-010' }),
      vehicle({ marca: 'Scania', modelo: 'R', config: '6x2', stock: 'ST-011' }),
    ];
    expect(groupByModel(units).size).toBe(2);
  });

  it('descarta unidades sin código de stock', () => {
    const units = [vehicle({ marca: 'Scania', modelo: 'R', stock: '' })];
    expect(groupByModel(units).size).toBe(0);
  });
});

describe('extractBrands', () => {
  it('respeta el orden fijo de marcas y agrupa el resto en OTROS', () => {
    const units = [
      vehicle({ marca: 'Scania', modelo: 'R', stock: 'ST-1' }),
      vehicle({ marca: 'Sinotruk', modelo: 'Howo', stock: 'ST-2' }),
      vehicle({ marca: 'Volvo', modelo: 'FH', stock: 'ST-3' }),
      vehicle({ marca: 'Iveco', modelo: 'Daily', stock: 'ST-4' }),
    ];

    const brands = extractBrands(groupByModel(units));
    expect(brands.map((brand) => brand.marca)).toEqual(['Sinotruk', 'Scania', 'OTROS']);

    const otros = brands.find((brand) => brand.isOtros);
    expect(otros?.otrosMarcas).toEqual(['Iveco', 'Volvo']);
    expect(otros?.modelCount).toBe(2);
  });
});

describe('groupByMarcaModelo', () => {
  it('agrega variantes del mismo marca+modelo en un resumen con rango de precio combinado', () => {
    const units = [
      vehicle({
        marca: 'Scania',
        modelo: 'R',
        config: '4x2',
        stock: 'ST-1',
        precioLista: '200.000',
      }),
      vehicle({
        marca: 'Scania',
        modelo: 'R',
        config: '6x2',
        stock: 'ST-2',
        precioLista: '250.000',
      }),
    ];

    const summaries = groupByMarcaModelo(groupByModel(units));
    expect(summaries.size).toBe(1);
    const [summary] = summaries.values();
    expect(summary?.variantCount).toBe(2);
    expect(summary?.unitCount).toBe(2);
    expect(summary?.precioMin).toBe(200000);
    expect(summary?.precioMax).toBe(250000);
  });
});

describe('filterByBrand / filterByBrandAndModelo', () => {
  const groups = groupByModel([
    vehicle({ marca: 'Scania', modelo: 'R', config: '4x2', stock: 'ST-1' }),
    vehicle({ marca: 'Scania', modelo: 'P', config: '4x2', stock: 'ST-2' }),
    vehicle({ marca: 'Volvo', modelo: 'FH', config: '4x2', stock: 'ST-3' }),
  ]);

  it('filtra por marca (case-insensitive)', () => {
    expect(filterByBrand(groups, 'scania').size).toBe(2);
  });

  it('el bucket OTROS incluye todo lo que no está en BRAND_ORDER', () => {
    expect(filterByBrand(groups, 'OTROS').size).toBe(1);
  });

  it('filtra por marca + modelo', () => {
    expect(filterByBrandAndModelo(groups, 'Scania', 'R').size).toBe(1);
  });
});

describe('getFilterOptions / applyFilters', () => {
  const groups = groupByModel([
    vehicle({
      marca: 'Scania',
      modelo: 'R',
      config: '4x2',
      tipoCaja: 'Automática',
      color: 'Blanco',
      stock: 'ST-1',
      anioFab: '2024',
    }),
    vehicle({
      marca: 'Scania',
      modelo: 'R',
      config: '6x2',
      tipoCaja: 'Manual',
      color: 'Rojo',
      stock: 'ST-2',
      anioFab: '2023',
    }),
  ]);

  it('extrae opciones únicas ordenadas para un campo de unidad', () => {
    expect(getFilterOptions(groups, 'tipoCaja')).toEqual(['Automática', 'Manual']);
  });

  it('filtra por texto de búsqueda', () => {
    const filtered = applyFilters(groups, 'automática', {
      config: '',
      susp: '',
      tipoMotor: '',
      tipoCaja: '',
      color: '',
      ubicacion: '',
      aire: '',
      anioFab: '',
    });
    expect(filtered.size).toBe(0);
  });

  it('filtra por un campo de unidad (al menos una unidad debe matchear)', () => {
    const filtered = applyFilters(groups, '', {
      config: '',
      susp: '',
      tipoMotor: '',
      tipoCaja: 'Manual',
      color: '',
      ubicacion: '',
      aire: '',
      anioFab: '',
    });
    expect(filtered.size).toBe(1);
    const [group] = filtered.values();
    expect(group?.config).toBe('6x2');
  });

  it('filtra por año de fabricación', () => {
    const filtered = applyFilters(groups, '', {
      config: '',
      susp: '',
      tipoMotor: '',
      tipoCaja: '',
      color: '',
      ubicacion: '',
      aire: '',
      anioFab: '2024',
    });
    expect(filtered.size).toBe(1);
  });
});

describe('getGroupKey', () => {
  it('usa chasis como respaldo cuando config está vacío', () => {
    const key = getGroupKey(vehicle({ marca: 'Facchini', modelo: 'X', chasis: 'Tandem' }));
    expect(key).toBe('FACCHINI|X|TANDEM||');
  });
});
