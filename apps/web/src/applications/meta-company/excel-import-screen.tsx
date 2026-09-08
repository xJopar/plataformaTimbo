import { useState, type ChangeEvent } from 'react';
import { reportBrowserOperationFailed } from '../../browser-diagnostics';
import type { ApplicationsApi } from '../../api/applications';
import {
  readMetaCompanyExcelImport,
  type MetaCompanyExcelImportOperation,
  type MetaCompanyExcelImportResult,
} from './meta-company-excel-import';
import type { Catalogs } from './meta-company-types';

interface ExcelImportScreenProps {
  applicationsApi: ApplicationsApi;
  catalogs: Catalogs;
  onCompleted: () => Promise<void>;
}

interface ImportSummary {
  created: number;
  updated: number;
  failed: { source: string; message: string }[];
}

export function ExcelImportScreen({
  applicationsApi,
  catalogs,
  onCompleted,
}: ExcelImportScreenProps): React.JSX.Element {
  const [result, setResult] = useState<MetaCompanyExcelImportResult>();
  const [selectedFileName, setSelectedFileName] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary>();

  const readFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    setResult(undefined);
    setSummary(undefined);
    setFileError(undefined);
    if (file === undefined) return;
    setSelectedFileName(file.name);
    setIsReading(true);
    try {
      setResult(await readMetaCompanyExcelImport(file, catalogs));
    } catch (error: unknown) {
      setFileError(
        error instanceof Error ? error.message : 'No pudimos leer el archivo seleccionado.',
      );
    } finally {
      setIsReading(false);
    }
  };

  const importGoals = async (): Promise<void> => {
    if (result === undefined || result.operations.length === 0) return;
    setIsImporting(true);
    setSummary(undefined);
    const goalsByPeriod = new Map<
      string,
      Awaited<ReturnType<ApplicationsApi['listMetaCompanyGoals']>>
    >();
    const importSummary: ImportSummary = { created: 0, failed: [], updated: 0 };
    try {
      for (const operation of result.operations) {
        const goals =
          goalsByPeriod.get(operation.input.period) ??
          (await applicationsApi.listMetaCompanyGoals(operation.input.period));
        goalsByPeriod.set(operation.input.period, goals);
        await importOperation(operation, goals, catalogs, applicationsApi, importSummary);
      }
      if (importSummary.created + importSummary.updated > 0) await onCompleted();
    } catch (error: unknown) {
      reportBrowserOperationFailed(error, {
        operation: 'meta-company.import-goals',
        method: 'POST',
        provider: 'api',
        route: '/api/applications/meta-company',
      });
      importSummary.failed.push({
        source: 'Importación',
        message: 'Se interrumpió la importación. Volvé a intentar las filas pendientes.',
      });
    } finally {
      setSummary(importSummary);
      setIsImporting(false);
    }
  };

  return (
    <section className="mc-workbench mc-import" aria-labelledby="mc-import-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-import-title">Importar metas desde Excel</h2>
          <p>Elegí la plantilla completada. Revisamos cada fila antes de guardar.</p>
        </div>
      </div>
      <label className="mc-file-input">
        <span>Archivo Excel</span>
        <input
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => void readFile(event)}
          type="file"
        />
      </label>
      {selectedFileName === undefined ? null : (
        <p className="mc-import-file">Archivo: {selectedFileName}</p>
      )}
      {isReading ? <p className="mc-state">Revisando archivo…</p> : null}
      {fileError === undefined ? null : (
        <p className="mc-error" role="alert">
          {fileError}
        </p>
      )}
      {result === undefined ? null : (
        <>
          <p className="mc-import-summary">
            {result.operations.length} filas listas para importar · {result.errors.length} filas con
            observaciones.
          </p>
          {result.errors.length === 0 ? null : (
            <ul className="mc-import-errors">
              {result.errors.slice(0, 10).map((item) => (
                <li key={`${item.source}-${item.message}`}>
                  <strong>{item.source}:</strong> {item.message}
                </li>
              ))}
            </ul>
          )}
          <button
            className="mc-primary-action"
            disabled={isImporting || result.operations.length === 0}
            onClick={() => void importGoals()}
            type="button"
          >
            {isImporting ? 'Importando…' : `Importar ${result.operations.length} filas válidas`}
          </button>
        </>
      )}
      {summary === undefined ? null : (
        <p className={summary.failed.length === 0 ? 'mc-notice' : 'mc-error'} role="status">
          {summary.created} creadas · {summary.updated} actualizadas · {summary.failed.length}{' '}
          pendientes.
        </p>
      )}
    </section>
  );
}

async function importOperation(
  operation: MetaCompanyExcelImportOperation,
  goals: Awaited<ReturnType<ApplicationsApi['listMetaCompanyGoals']>>,
  catalogs: Catalogs,
  applicationsApi: ApplicationsApi,
  summary: ImportSummary,
): Promise<void> {
  try {
    if (operation.kind === 'brand') {
      const existing = goals.find(
        (goal) =>
          goal.goalType === 'Marca' &&
          goal.businessId === operation.input.businessId &&
          goal.brandId === operation.input.brandId,
      );
      if (existing === undefined) {
        await applicationsApi.createMetaCompanyBrandGoal(operation.input);
        summary.created += 1;
      } else {
        await applicationsApi.updateMetaCompanyBrandGoal(
          existing.id,
          operation.input.value,
          operation.input.workingDays,
        );
        summary.updated += 1;
      }
      return;
    }

    const advisorExternalCode = catalogs.advisors.find(
      (advisor) => advisor.id === operation.input.advisorId,
    )?.externalCode;
    const salespersonCode = Number(advisorExternalCode);
    const existing = Number.isSafeInteger(salespersonCode)
      ? goals.find(
          (goal) =>
            goal.goalType === 'Vendedor' &&
            goal.businessId === operation.input.businessId &&
            goal.brandId === (operation.input.brandId ?? null) &&
            goal.salespersonCode === salespersonCode,
        )
      : undefined;
    if (existing === undefined) {
      await applicationsApi.createMetaCompanyAdvisorGoal(operation.input);
      summary.created += 1;
    } else {
      await applicationsApi.updateMetaCompanyAdvisorGoal(existing.id, operation.input.value);
      summary.updated += 1;
    }
  } catch (error: unknown) {
    summary.failed.push({
      source: operation.source,
      message: error instanceof Error ? error.message : 'No pudimos guardar esta fila.',
    });
  }
}
