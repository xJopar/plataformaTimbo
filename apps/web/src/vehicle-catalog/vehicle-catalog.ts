import type { VehicleResponse } from '../api';

/**
 * Agrupa unidades individuales del catálogo en "modelos" únicos.
 *
 * CLAVE DE AGRUPACIÓN: Marca + Modelo + Config + Susp + TipoMotor. Dentro de cada grupo se
 * exponen las unidades individuales (stocks). Puerto directo de la lógica de presentación de la
 * app standalone original — el backend sólo entrega el catálogo crudo, este agrupamiento sigue
 * siendo responsabilidad del cliente.
 */

export interface VehicleGroup {
  key: string;
  marca: string;
  modelo: string;
  config: string;
  susp: string;
  tipoMotor: string;
  tipo: string;
  name: string;
  anios: string[];
  precioMin: number | null;
  precioMax: number | null;
  stockCount: number;
  units: VehicleResponse[];
}

export interface BrandSummary {
  marca: string;
  modelCount: number;
  unitCount: number;
  isOtros: boolean;
  otrosMarcas: string[];
}

export interface ModelSummary {
  key: string;
  marca: string;
  modelo: string;
  variantCount: number;
  unitCount: number;
  precioMin: number | null;
  precioMax: number | null;
  anios: string[];
}

export interface VehicleFilters {
  config: string;
  susp: string;
  tipoMotor: string;
  tipoCaja: string;
  color: string;
  ubicacion: string;
  aire: string;
  anioFab: string;
}

export function getGroupKey(unit: VehicleResponse): string {
  return [unit.marca, unit.modelo, unit.config || unit.chasis, unit.susp, unit.tipoMotor]
    .map((part) => part.trim().toUpperCase())
    .join('|');
}

export function buildModelName(unit: VehicleResponse): string {
  return [unit.marca, unit.modelo, unit.config || unit.chasis, unit.tipoMotor]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** "70.300" → 70300 | "1.234,56" → 1234.56 | "" → null */
export function parsePrice(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const parsed = parseFloat(raw.replace(/\./g, '').replace(',', '.').trim());
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatPrice(amount: number | null): string {
  return amount === null ? 'Precio a consultar' : `USD ${amount.toLocaleString('es-PY')}`;
}

export function groupByModel(units: VehicleResponse[]): Map<string, VehicleGroup> {
  const groups = new Map<
    string,
    Omit<VehicleGroup, 'precioMin' | 'precioMax'> & { precios: number[] }
  >();

  for (const unit of units) {
    if (!unit.stock) {
      continue;
    }

    const key = getGroupKey(unit);
    let group = groups.get(key);
    if (group === undefined) {
      group = {
        key,
        marca: unit.marca,
        modelo: unit.modelo,
        config: unit.config || unit.chasis,
        susp: unit.susp,
        tipoMotor: unit.tipoMotor,
        tipo: unit.tipo || unit.tipoUnidad,
        name: buildModelName(unit),
        anios: [],
        precios: [],
        stockCount: 0,
        units: [],
      };
      groups.set(key, group);
    }

    const precio = parsePrice(unit.precioLista);
    if (unit.anioFab && !group.anios.includes(unit.anioFab.slice(0, 4))) {
      group.anios.push(unit.anioFab.slice(0, 4));
    }
    if (precio !== null) {
      group.precios.push(precio);
    }
    group.stockCount += 1;
    group.units.push(unit);
  }

  const result = new Map<string, VehicleGroup>();
  for (const [key, group] of groups) {
    const { precios, ...rest } = group;
    result.set(key, {
      ...rest,
      anios: [...rest.anios].sort(),
      precioMin: precios.length > 0 ? Math.min(...precios) : null,
      precioMax: precios.length > 0 ? Math.max(...precios) : null,
    });
  }
  return result;
}

/** Orden fijo de marcas. Las que no estén acá van a "OTROS". */
const BRAND_ORDER = [
  'SINOTRUK',
  'SCANIA',
  'LIBRELATO',
  'FACCHINI',
  'SANY',
  'BAIC',
  'FOTON',
  'ZHONGTONG',
];

export function extractBrands(groups: Map<string, VehicleGroup>): BrandSummary[] {
  const rawBrands = new Map<string, { marca: string; modelCount: number; unitCount: number }>();

  for (const group of groups.values()) {
    const upperMarca = group.marca.trim().toUpperCase();
    if (!upperMarca) {
      continue;
    }
    let brand = rawBrands.get(upperMarca);
    if (brand === undefined) {
      brand = { marca: group.marca, modelCount: 0, unitCount: 0 };
      rawBrands.set(upperMarca, brand);
    }
    brand.modelCount += 1;
    brand.unitCount += group.stockCount;
  }

  const result: BrandSummary[] = [];

  for (const orderedBrand of BRAND_ORDER) {
    const brand = rawBrands.get(orderedBrand);
    if (brand !== undefined) {
      result.push({ ...brand, isOtros: false, otrosMarcas: [] });
    }
  }

  const otherEntries = [...rawBrands.entries()].filter(([key]) => !BRAND_ORDER.includes(key));
  if (otherEntries.length > 0) {
    const otros: BrandSummary = {
      marca: 'OTROS',
      modelCount: 0,
      unitCount: 0,
      isOtros: true,
      otrosMarcas: otherEntries.map(([, brand]) => brand.marca).sort(),
    };
    for (const [, brand] of otherEntries) {
      otros.modelCount += brand.modelCount;
      otros.unitCount += brand.unitCount;
    }
    result.push(otros);
  }

  return result;
}

export function groupByMarcaModelo(groups: Map<string, VehicleGroup>): Map<string, ModelSummary> {
  const result = new Map<
    string,
    Omit<ModelSummary, 'precioMin' | 'precioMax'> & { precios: number[] }
  >();

  for (const group of groups.values()) {
    const key = `${group.marca.trim().toUpperCase()}|${group.modelo.trim().toUpperCase()}`;
    let summary = result.get(key);
    if (summary === undefined) {
      summary = {
        key,
        marca: group.marca,
        modelo: group.modelo,
        variantCount: 0,
        unitCount: 0,
        precios: [],
        anios: [],
      };
      result.set(key, summary);
    }

    summary.variantCount += 1;
    summary.unitCount += group.stockCount;
    if (group.precioMin !== null) summary.precios.push(group.precioMin);
    if (group.precioMax !== null) summary.precios.push(group.precioMax);
    for (const anio of group.anios) {
      if (!summary.anios.includes(anio)) summary.anios.push(anio);
    }
  }

  const summaries = new Map<string, ModelSummary>();
  for (const [key, summary] of result) {
    const { precios, ...rest } = summary;
    summaries.set(key, {
      ...rest,
      anios: [...rest.anios].sort(),
      precioMin: precios.length > 0 ? Math.min(...precios) : null,
      precioMax: precios.length > 0 ? Math.max(...precios) : null,
    });
  }
  return summaries;
}

function matchesBrand(group: VehicleGroup, upperBrand: string): boolean {
  return upperBrand === 'OTROS'
    ? !BRAND_ORDER.includes(group.marca.trim().toUpperCase())
    : group.marca.trim().toUpperCase() === upperBrand;
}

export function filterByBrandAndModelo(
  groups: Map<string, VehicleGroup>,
  brand: string,
  modelo: string,
): Map<string, VehicleGroup> {
  const upperBrand = brand.trim().toUpperCase();
  const upperModelo = modelo.trim().toUpperCase();
  const result = new Map<string, VehicleGroup>();

  for (const [key, group] of groups) {
    if (matchesBrand(group, upperBrand) && group.modelo.trim().toUpperCase() === upperModelo) {
      result.set(key, group);
    }
  }
  return result;
}

export function filterByBrand(
  groups: Map<string, VehicleGroup>,
  brand: string,
): Map<string, VehicleGroup> {
  const upperBrand = brand.trim().toUpperCase();
  const result = new Map<string, VehicleGroup>();

  for (const [key, group] of groups) {
    if (matchesBrand(group, upperBrand)) {
      result.set(key, group);
    }
  }
  return result;
}

/**
 * Extrae valores únicos de un campo para poblar los chips del filtro. El campo puede vivir en el
 * grupo (config/susp/tipoMotor) o sólo en las unidades individuales (tipoCaja/color/ubicacion/
 * aire) — igual que el original, que indexaba dinámicamente sin distinguir la forma del objeto.
 */
export function getFilterOptions(
  groups: Map<string, VehicleGroup>,
  field: keyof VehicleGroup | keyof VehicleResponse,
): string[] {
  const values = new Set<string>();
  for (const group of groups.values()) {
    const groupValue = (group as unknown as Record<string, unknown>)[field];
    if (typeof groupValue === 'string' && groupValue) {
      values.add(groupValue);
    }
    for (const unit of group.units) {
      const unitValue = unit[field as keyof VehicleResponse];
      if (unitValue) {
        values.add(unitValue);
      }
    }
  }
  return [...values].sort();
}

export function applyFilters(
  groups: Map<string, VehicleGroup>,
  search: string,
  filters: VehicleFilters,
): Map<string, VehicleGroup> {
  const query = search.trim().toLowerCase();
  const result = new Map<string, VehicleGroup>();

  for (const [key, group] of groups) {
    if (query) {
      const haystack = [group.marca, group.modelo, group.config, group.tipoMotor, group.tipo]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) continue;
    }

    if (filters.config && group.config.toUpperCase() !== filters.config.toUpperCase()) continue;
    if (filters.susp && group.susp.toUpperCase() !== filters.susp.toUpperCase()) continue;
    if (filters.tipoMotor && group.tipoMotor.toUpperCase() !== filters.tipoMotor.toUpperCase())
      continue;
    if (filters.anioFab && !group.anios.includes(filters.anioFab)) continue;

    if (filters.tipoCaja || filters.color || filters.ubicacion || filters.aire) {
      const matchesUnit = group.units.some((unit) => {
        if (filters.tipoCaja && unit.tipoCaja.toUpperCase() !== filters.tipoCaja.toUpperCase())
          return false;
        if (filters.color && unit.color.toUpperCase() !== filters.color.toUpperCase()) return false;
        if (filters.ubicacion && unit.ubicacion.toUpperCase() !== filters.ubicacion.toUpperCase())
          return false;
        if (filters.aire && unit.aire.toUpperCase() !== filters.aire.toUpperCase()) return false;
        return true;
      });
      if (!matchesUnit) continue;
    }

    result.set(key, group);
  }

  return result;
}
