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
import { FinancingConfig, type FinancingConfigValue } from './financing-config';
import { InstallmentSummary } from './installment-summary';
import {
  calculateInstallmentPlan,
  formatUsd,
  sumItemsUsd,
  type CalculatorItem,
} from './installment-calculator';
import { parseCalculadoraCuotasRoute } from './calculadora-cuotas-routes';

const DEFAULT_CONFIG: FinancingConfigValue = {
  downPaymentMode: 'percent',
  downPaymentPercent: 20,
  downPaymentManualUsd: 0,
  termMonths: 36,
  installmentPeriodicity: 'mensual',
  reinforcementsEnabled: false,
  reinforcementPeriodicity: 'semestral',
  desiredRegularInstallmentAmountUsd: 0,
};

type WizardScreen = 'main' | 'config' | 'result';

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
  const [draftConfig, setDraftConfig] = useState<FinancingConfigValue>(DEFAULT_CONFIG);
  const [calculatedConfig, setCalculatedConfig] = useState<FinancingConfigValue>(DEFAULT_CONFIG);
  const [screen, setScreen] = useState<WizardScreen>('main');
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
  const planResult = useMemo(
    () =>
      calculateInstallmentPlan({
        items,
        downPaymentMode: calculatedConfig.downPaymentMode,
        downPaymentPercent: calculatedConfig.downPaymentPercent,
        downPaymentManualUsd: calculatedConfig.downPaymentManualUsd,
        termMonths: calculatedConfig.termMonths,
        installmentPeriodicity: calculatedConfig.installmentPeriodicity,
        reinforcementsEnabled: calculatedConfig.reinforcementsEnabled,
        reinforcementPeriodicity: calculatedConfig.reinforcementPeriodicity,
        desiredRegularInstallmentAmountUsd: calculatedConfig.desiredRegularInstallmentAmountUsd,
      }),
    [items, calculatedConfig],
  );

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

  function calculatePlan(): void {
    setCalculatedConfig(draftConfig);
    setScreen('result');
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

      <div className="cc-page">
        {preloadNotice === undefined ? null : (
          <p className="cc-preload-notice" role="status">
            {preloadNotice}
          </p>
        )}

        <div className="cc-wizard" aria-label="Flujo de cálculo">
          <ol className="cc-wizard-steps">
            <li
              className={screen === 'main' ? 'cc-wizard-step--active' : 'cc-wizard-step--complete'}
            >
              Unidades
            </li>
            <li
              className={
                screen === 'config'
                  ? 'cc-wizard-step--active'
                  : screen === 'result'
                    ? 'cc-wizard-step--complete'
                    : ''
              }
            >
              Configuración
            </li>
            <li className={screen === 'result' ? 'cc-wizard-step--active' : ''}>Plan final</li>
          </ol>

          {screen === 'main' ? (
            <div className="cc-wizard-screen cc-wizard-screen--main">
              <AddItemPanel
                vehiclesState={vehiclesState}
                existingItemIds={existingItemIds}
                onAddItem={addItem}
              />
              <AddedItemsList items={items} onRequestRemove={setPendingRemovalId} />
              <footer className="cc-wizard-actions">
                <span className="cc-wizard-total">Total: {formatUsd(totalPriceUsd)}</span>
                <button
                  type="button"
                  className="cc-apply-btn"
                  disabled={!hasItems}
                  onClick={() => setScreen('config')}
                >
                  Continuar con la financiación
                </button>
              </footer>
            </div>
          ) : null}

          {screen === 'config' ? (
            <div className="cc-wizard-screen cc-wizard-screen--config">
              <FinancingConfig
                value={draftConfig}
                totalPriceUsd={totalPriceUsd}
                onChange={setDraftConfig}
                onBack={() => setScreen('main')}
                onCalculate={calculatePlan}
              />
            </div>
          ) : null}

          {screen === 'result' ? (
            <div className="cc-wizard-screen cc-wizard-screen--result">
              <InstallmentSummary
                planResult={planResult}
                installmentPeriodicity={calculatedConfig.installmentPeriodicity}
                reinforcementPeriodicity={calculatedConfig.reinforcementPeriodicity}
              />
              <footer className="cc-wizard-actions">
                <button
                  type="button"
                  className="cc-secondary-action"
                  onClick={() => setScreen('main')}
                >
                  Editar unidades
                </button>
                <button type="button" className="cc-apply-btn" onClick={() => setScreen('config')}>
                  Cambiar configuración
                </button>
              </footer>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmRemoveDialog
        item={pendingRemovalItem}
        onCancel={() => setPendingRemovalId(undefined)}
        onConfirm={confirmRemoval}
      />
    </main>
  );
}
