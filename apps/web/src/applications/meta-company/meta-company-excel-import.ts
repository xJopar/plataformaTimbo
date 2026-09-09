import type {
  MetaCompanyAdvisorGoalRequest,
  MetaCompanyBrandGoalRequest,
} from '../../api/applications';
import type { Catalogs } from './meta-company-types';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1_000;

export type MetaCompanyExcelImportOperation =
  | {
      kind: 'advisor';
      source: string;
      input: MetaCompanyAdvisorGoalRequest;
    }
  | {
      kind: 'brand';
      source: string;
      input: MetaCompanyBrandGoalRequest;
    };

export interface MetaCompanyExcelImportError {
  source: string;
  message: string;
}

export interface MetaCompanyExcelImportResult {
  operations: MetaCompanyExcelImportOperation[];
  errors: MetaCompanyExcelImportError[];
}

interface WorksheetImportDefinition {
  sheetName: 'Metas Timbo' | 'Metas Marcas';
  kind: MetaCompanyExcelImportOperation['kind'];
  requiredHeaders: readonly string[];
}

const WORKSHEET_IMPORT_DEFINITIONS: readonly WorksheetImportDefinition[] = [
  {
    sheetName: 'Metas Timbo',
    kind: 'advisor',
    requiredHeaders: ['fecha', 'id_vendedor', 'meta', 'negocio'],
  },
  {
    sheetName: 'Metas Marcas',
    kind: 'brand',
    requiredHeaders: ['fecha', 'marca', 'meta', 'negocio'],
  },
];

export async function readMetaCompanyExcelImport(
  file: File,
  catalogs: Catalogs,
): Promise<MetaCompanyExcelImportResult> {
  validateFile(file);
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true, type: 'array' });
  const sheets = new Map<string, unknown[][]>();

  for (const definition of WORKSHEET_IMPORT_DEFINITIONS) {
    const worksheet = workbook.Sheets[definition.sheetName];
    if (worksheet !== undefined) {
      sheets.set(
        definition.sheetName,
        XLSX.utils.sheet_to_json<unknown[]>(worksheet, { defval: null, header: 1, raw: false }),
      );
    }
  }

  return parseMetaCompanyExcelImport(sheets, catalogs);
}

export function parseMetaCompanyExcelImport(
  sheets: ReadonlyMap<string, readonly unknown[][]>,
  catalogs: Catalogs,
): MetaCompanyExcelImportResult {
  const operations: MetaCompanyExcelImportOperation[] = [];
  const errors: MetaCompanyExcelImportError[] = [];

  for (const definition of WORKSHEET_IMPORT_DEFINITIONS) {
    const rows = sheets.get(definition.sheetName);
    if (rows === undefined) continue;
    parseWorksheet(rows, definition, catalogs, operations, errors);
  }

  if (operations.length === 0 && errors.length === 0) {
    errors.push({
      source: 'Archivo',
      message: 'No encontramos las hojas “Metas Timbo” ni “Metas Marcas”.',
    });
  }

  if (operations.length > MAX_IMPORT_ROWS) {
    return {
      operations: [],
      errors: [
        {
          source: 'Archivo',
          message: `La importación admite hasta ${String(MAX_IMPORT_ROWS)} filas por archivo.`,
        },
      ],
    };
  }

  return { operations: removeDuplicateOperations(operations, errors), errors };
}

function parseWorksheet(
  rows: readonly unknown[][],
  definition: WorksheetImportDefinition,
  catalogs: Catalogs,
  operations: MetaCompanyExcelImportOperation[],
  errors: MetaCompanyExcelImportError[],
): void {
  const headerRow = rows[0];
  if (headerRow === undefined) {
    errors.push({ source: definition.sheetName, message: 'La hoja no tiene encabezados.' });
    return;
  }

  const headerIndexes = createHeaderIndexes(headerRow);
  const missingHeaders = definition.requiredHeaders.filter((header) => !headerIndexes.has(header));
  if (missingHeaders.length > 0) {
    errors.push({
      source: definition.sheetName,
      message: `Faltan los encabezados: ${missingHeaders.join(', ')}.`,
    });
    return;
  }

  rows.slice(1).forEach((row, index) => {
    if (row.every(isEmptyCell)) return;
    const source = `${definition.sheetName}, fila ${String(index + 2)}`;
    const operation =
      definition.kind === 'advisor'
        ? parseAdvisorRow(row, headerIndexes, catalogs, source)
        : parseBrandRow(row, headerIndexes, catalogs, source);
    if ('message' in operation) errors.push(operation);
    else operations.push(operation);
  });
}

function parseAdvisorRow(
  row: readonly unknown[],
  headerIndexes: ReadonlyMap<string, number>,
  catalogs: Catalogs,
  source: string,
): MetaCompanyExcelImportOperation | MetaCompanyExcelImportError {
  const period = parsePeriod(readCell(row, headerIndexes, 'fecha'));
  const value = parseAmount(readCell(row, headerIndexes, 'meta'));
  const advisor = findSingleBy(
    catalogs.advisors,
    'externalCode',
    asText(readCell(row, headerIndexes, 'id_vendedor')),
  );
  const business = findSingleBy(
    catalogs.businesses,
    'name',
    asText(readCell(row, headerIndexes, 'negocio')),
  );
  const brandName = asText(readCell(row, headerIndexes, 'marca'));
  const brand = brandName === '' ? undefined : findSingleBy(catalogs.brands, 'name', brandName);

  if (period === undefined) return error(source, 'La fecha debe ser el primer día de un mes.');
  if (value === undefined) return error(source, 'La meta debe ser un número no negativo.');
  if (advisor === undefined)
    return error(source, 'No encontramos un asesor activo con ese id_vendedor.');
  if (business === undefined)
    return error(source, 'No encontramos un negocio activo con ese nombre.');
  if (brandName !== '' && brand === undefined)
    return error(source, 'No encontramos una marca activa con ese nombre.');

  return {
    kind: 'advisor',
    source,
    input: {
      period,
      businessId: business.id,
      ...(brand === undefined ? {} : { brandId: brand.id }),
      advisorId: advisor.id,
      value,
    },
  };
}

function parseBrandRow(
  row: readonly unknown[],
  headerIndexes: ReadonlyMap<string, number>,
  catalogs: Catalogs,
  source: string,
): MetaCompanyExcelImportOperation | MetaCompanyExcelImportError {
  const period = parsePeriod(readCell(row, headerIndexes, 'fecha'));
  const value = parseAmount(readCell(row, headerIndexes, 'meta'));
  const brand = findSingleBy(
    catalogs.brands,
    'name',
    asText(readCell(row, headerIndexes, 'marca')),
  );
  const business = findSingleBy(
    catalogs.businesses,
    'name',
    asText(readCell(row, headerIndexes, 'negocio')),
  );
  const workingDays = parseWorkingDays(readCell(row, headerIndexes, 'dias habiles'));

  if (period === undefined) return error(source, 'La fecha debe ser el primer día de un mes.');
  if (value === undefined) return error(source, 'La meta debe ser un número no negativo.');
  if (brand === undefined) return error(source, 'No encontramos una marca activa con ese nombre.');
  if (business === undefined)
    return error(source, 'No encontramos un negocio activo con ese nombre.');
  if (workingDays === null) return error(source, 'Días hábiles debe ser un entero positivo.');

  return {
    kind: 'brand',
    source,
    input: {
      period,
      businessId: business.id,
      brandId: brand.id,
      value,
      ...(workingDays === undefined ? {} : { workingDays }),
    },
  };
}

function removeDuplicateOperations(
  operations: readonly MetaCompanyExcelImportOperation[],
  errors: MetaCompanyExcelImportError[],
): MetaCompanyExcelImportOperation[] {
  const keys = new Set<string>();
  return operations.filter((operation) => {
    const key =
      operation.kind === 'brand'
        ? `brand:${operation.input.period}:${String(operation.input.businessId)}:${String(operation.input.brandId)}`
        : `advisor:${operation.input.period}:${String(operation.input.businessId)}:${String(operation.input.advisorId)}:${String(operation.input.brandId ?? 'all')}`;
    if (!keys.has(key)) {
      keys.add(key);
      return true;
    }
    errors.push({
      source: operation.source,
      message: 'La fila repite una meta ya incluida en el archivo.',
    });
    return false;
  });
}

function createHeaderIndexes(row: readonly unknown[]): Map<string, number> {
  const indexes = new Map<string, number>();
  row.forEach((value, index) => indexes.set(normalizeText(asText(value)), index));
  return indexes;
}

function findSingleBy<T extends { id: number }>(
  items: readonly T[],
  property: keyof T,
  requestedValue: string,
): T | undefined {
  const matches = items.filter(
    (item) => normalizeText(String(item[property])) === normalizeText(requestedValue),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function readCell(
  row: readonly unknown[],
  headerIndexes: ReadonlyMap<string, number>,
  header: string,
): unknown {
  const index = headerIndexes.get(header);
  return index === undefined ? undefined : row[index];
}

function parsePeriod(value: unknown): string | undefined {
  const text = asText(value);
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const localizedMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const matchedDate = isoMatch ?? localizedMatch;
  if (matchedDate === null) return undefined;
  const [, firstPart, secondPart, thirdPart] = matchedDate;
  if (firstPart === undefined || secondPart === undefined || thirdPart === undefined)
    return undefined;
  const [year, month, day] =
    isoMatch === null ? [thirdPart, secondPart, firstPart] : [firstPart, secondPart, thirdPart];
  if (day !== '01' || Number(month) < 1 || Number(month) > 12) return undefined;
  return `${year}-${month}-01`;
}

function parseAmount(value: unknown): string | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 ? value.toFixed(2) : undefined;
  const text = asText(value);
  if (text === '') return undefined;
  const normalized = text.includes(',')
    ? text.replaceAll('.', '').replace(',', '.')
    : /^(\d{1,3}(?:\.\d{3})+)$/.test(text)
      ? text.replaceAll('.', '')
      : text;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue.toFixed(2) : undefined;
}

function parseWorkingDays(value: unknown): number | undefined | null {
  if (isEmptyCell(value)) return undefined;
  const numberValue = Number(asText(value));
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function validateFile(file: File): void {
  if (!file.name.toLowerCase().endsWith('.xlsx'))
    throw new Error('Seleccioná un archivo con extensión .xlsx.');
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('El archivo no puede superar 5 MB.');
}

function normalizeText(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PY');
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function isEmptyCell(value: unknown): boolean {
  return asText(value) === '';
}

function error(source: string, message: string): MetaCompanyExcelImportError {
  return { source, message };
}
