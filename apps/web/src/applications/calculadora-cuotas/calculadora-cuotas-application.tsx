import { useEffect, useMemo, useRef, useState } from 'react';
import type { ApplicationComponentProps } from '../application-component';
import { PlatformHeader } from '../../layout/platform-header';
import { PlatformSessionBar } from '../../layout/platform-session-bar';
import { useVehicleCatalog } from '../../vehicle-catalog/use-vehicle-catalog';
import { parsePrice } from '../../vehicle-catalog/vehicle-catalog';
import './calculadora-cuotas-application.css';
import { AddItemPanel } from './add-item-panel';
import { AddedItemsList } from './added-items-list';
import { ConfirmRemoveDialog } from './confirm-remove-dialog';
import { FinancingConfig, isSameFinancingConfig, type FinancingConfigValue } from './financing-config';
import { InstallmentSummary } from './installment-summary';
import { calculateInstallmentPlan, sumItemsUsd, type CalculatorItem } from './installment-calculator';
import { parseCalculadoraCuotasRoute } from './calculadora-cuotas-routes';

const DEFAULT_CONFIG: FinancingConfigValue = {
  downPaymentMode: 'percent',
  downPaymentPercent: 20,
  downPaymentManualUsd: 0,
  termMonths: 36,
  installmentPeriodicity: 'mensual',
  reinforcementsEnabled: true,
  reinforcementPeriodicity: 'semestral',
};

export function CalculadoraCuotasApplication({
  api,
  application,
  availableApplications,
  session,
  pathname,
  isLoggingOut,
  logoutFailure,
  onNavigate,
  onLogout,
}: ApplicationComponentProps): React.JSX.Element {
  const { state: vehiclesState } = useVehicleCatalog(api);
  const [items, setItems] = useState<CalculatorItem[]>([]);
  // `draftConfig` sigue los controles en vivo; `appliedConfig` es lo que realmente alimenta el
  // cálculo y sólo se actualiza al presionar "Calcular" — así plazo/entrega inicial/periodicidad
  // quedan quietos mientras se ajustan, en vez de recalcular en cada tecla o clic.
  const [draftConfig, setDraftConfig] = useState<FinancingConfigValue>(DEFAULT_CONFIG);
  const [appliedConfig, setAppliedConfig] = useState<FinancingConfigValue>(DEFAULT_CONFIG);
  const [pendingRemovalId, setPendingRemovalId] = useState<string | undefined>(undefined);
  const [preloadNotice, setPreloadNotice] = useState<string | undefined>(undefined);
  const preloadHandled = useRef(false);

  const route = useMemo(
    () => parseCalculadoraCuotasRoute(pathname, application.launchPath),
    [pathname, application.launchPath],
  );

  useEffect(() => {
    if (route.view !== 'from-stock' || preloadHandled.current || vehiclesState.status !== 'ready') {
      return;
    }
    preloadHandled.current = true;

    for (const group of vehiclesState.groups.values()) {
      const unit = group.units.find((candidate) => candidate.stock === route.stock);
      if (unit === undefined) continue;
      const priceUsd = parsePrice(unit.precioLista);
      if (priceUsd === null) continue;
      setItems((current) => [
        ...current,
        {
          id: `catalog:${unit.stock}`,
          source: 'catalog',
          label: group.name,
          detail: `Stock ${unit.stock}`,
          priceUsd,
        },
      ]);
      setPreloadNotice(`Se agregó ${group.name} (stock ${unit.stock}) desde Lista de Precios.`);
      return;
    }
    setPreloadNotice('No encontramos esa unidad en el catálogo actual de Lista de Precios.');
  }, [route, vehiclesState]);

  const existingItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const totalPriceUsd = useMemo(() => sumItemsUsd(items), [items]);
  const plan = useMemo(
    () =>
      calculateInstallmentPlan({
        items,
        downPaymentMode: appliedConfig.downPaymentMode,
        downPaymentPercent: appliedConfig.downPaymentPercent,
        downPaymentManualUsd: appliedConfig.downPaymentManualUsd,
        termMonths: appliedConfig.termMonths,
        installmentPeriodicity: appliedConfig.installmentPeriodicity,
        reinforcementsEnabled: appliedConfig.reinforcementsEnabled,
        reinforcementPeriodicity: appliedConfig.reinforcementPeriodicity,
      }),
    [items, appliedConfig],
  );
  const isConfigDirty = !isSameFinancingConfig(draftConfig, appliedConfig);

  const pendingRemovalItem = items.find((item) => item.id === pendingRemovalId);
  const hasItems = items.length > 0;

  function addItem(item: CalculatorItem): void {
    if (existingItemIds.has(item.id)) return;
    setItems((current) => [...current, item]);
  }

  function confirmRemoval(itemId: string): void {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setPendingRemovalId(undefined);
  }

  function applyConfig(): void {
    setAppliedConfig(draftConfig);
  }

  function jumpToCuotero(): void {
    const section = document.getElementById('cc-cuotero-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section?.focus();
  }

  function handleMobileBarClick(): void {
    if (isConfigDirty) applyConfig();
    jumpToCuotero();
  }

  return (
    <main className="platform-shell calculadora-cuotas-shell">
      <PlatformHeader
        applications={availableApplications}
        applicationName={application.name}
        applicationLaunchPath={application.launchPath}
        isLoggingOut={isLoggingOut}
        isPlatformAdministrator={session.isPlatformAdministrator}
        showAdministrationLink={false}
        variant="application"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <PlatformSessionBar session={session} />

      {logoutFailure === undefined ? null : (
        <p className="cc-logout-error" role="alert">
          No se pudo cerrar la sesión. Intentá nuevamente.
        </p>
      )}

      <div className={`cc-page${hasItems ? ' cc-page--has-mobile-bar' : ''}`}>
        {preloadNotice === undefined ? null : (
          <p className="cc-preload-notice" role="status">
            {preloadNotice}
          </p>
        )}

        <div className="cc-layout">
          <div className="cc-layout-main">
            <AddItemPanel
              vehiclesState={vehiclesState}
              existingItemIds={existingItemIds}
              onAddItem={addItem}
            />
            <AddedItemsList items={items} onRequestRemove={setPendingRemovalId} />
          </div>

          <div className="cc-layout-aside">
            <FinancingConfig
              value={draftConfig}
              totalPriceUsd={totalPriceUsd}
              isDirty={isConfigDirty}
              onChange={setDraftConfig}
              onApply={applyConfig}
            />
            <InstallmentSummary
              plan={plan}
              installmentPeriodicity={appliedConfig.installmentPeriodicity}
              reinforcementPeriodicity={appliedConfig.reinforcementPeriodicity}
            />
          </div>
        </div>
      </div>

      {hasItems ? (
        <div className="cc-mobile-summary" role="status">
          <span className="cc-mobile-summary-total">
            USD {totalPriceUsd.toLocaleString('es-PY')}
          </span>
          <button type="button" className="cc-mobile-summary-btn" onClick={handleMobileBarClick}>
            {isConfigDirty ? 'Calcular cuota' : 'Ver cuotero'}
          </button>
        </div>
      ) : null}

      <ConfirmRemoveDialog
        item={pendingRemovalItem}
        onCancel={() => setPendingRemovalId(undefined)}
        onConfirm={confirmRemoval}
      />
    </main>
  );
}
