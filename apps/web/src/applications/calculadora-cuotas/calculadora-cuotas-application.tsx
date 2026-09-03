import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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
          quantity: 1,
        },
      ]);
      requestAnimationFrame(() => {
        toast.info(`Se agregó ${group.name} (stock ${unit.stock}) desde Lista de Precios.`);
      });
      return;
    }
    requestAnimationFrame(() => {
      toast.info('No encontramos esa unidad en el catálogo actual de Lista de Precios.');
    });
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
  const totalQuantity = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );
  const [screenTransitionDirection, setScreenTransitionDirection] = useState<
    'forward' | 'backward'
  >('forward');
  const [shouldAnimateScreen, setShouldAnimateScreen] = useState(false);
  const [screenTransitionKey, setScreenTransitionKey] = useState(0);

  function addItem(item: CalculatorItem): void {
    if (existingItemIds.has(item.id)) return;
    setItems((current) => [...current, item]);
  }

  function confirmRemoval(itemId: string): void {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setPendingRemovalId(undefined);
  }

  function incrementItemQuantity(itemId: string): void {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item)),
    );
  }

  function decrementItemQuantity(itemId: string): void {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId && item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : item,
      ),
    );
  }

  function changeScreen(
    nextScreen: WizardScreen,
    direction: 'forward' | 'backward',
    isPointerInitiated: boolean,
  ): void {
    setScreenTransitionDirection(direction);
    setShouldAnimateScreen(isPointerInitiated);
    setScreenTransitionKey((current) => current + 1);
    setScreen(nextScreen);
  }

  function calculatePlan(isPointerInitiated: boolean): void {
    setCalculatedConfig(draftConfig);
    changeScreen('result', 'forward', isPointerInitiated);
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
        <div className="cc-wizard" aria-label="Flujo de cálculo">
          <ol className="cc-wizard-steps">
            <li
              className={screen === 'main' ? 'cc-wizard-step--active' : 'cc-wizard-step--complete'}
              aria-current={screen === 'main' ? 'step' : undefined}
            >
              <span className="cc-wizard-step-marker" aria-hidden="true">
                {screen === 'main' ? '1' : '✓'}
              </span>
              <span>Unidades</span>
              <span className="cc-sr-only">{screen === 'main' ? 'Actual.' : 'Completado.'}</span>
            </li>
            <li
              className={
                screen === 'config'
                  ? 'cc-wizard-step--active'
                  : screen === 'result'
                    ? 'cc-wizard-step--complete'
                    : ''
              }
              aria-current={screen === 'config' ? 'step' : undefined}
            >
              <span className="cc-wizard-step-marker" aria-hidden="true">
                {screen === 'result' ? '✓' : '2'}
              </span>
              <span>Condiciones</span>
              <span className="cc-sr-only">
                {screen === 'config'
                  ? 'Actual.'
                  : screen === 'result'
                    ? 'Completado.'
                    : 'Pendiente.'}
              </span>
            </li>
            <li
              className={screen === 'result' ? 'cc-wizard-step--active' : ''}
              aria-current={screen === 'result' ? 'step' : undefined}
            >
              <span className="cc-wizard-step-marker" aria-hidden="true">
                3
              </span>
              <span>Plan final</span>
              <span className="cc-sr-only">{screen === 'result' ? 'Actual.' : 'Pendiente.'}</span>
            </li>
          </ol>

          {screen === 'main' ? (
            <div
              key={`main-${screenTransitionKey}`}
              className="cc-wizard-screen cc-wizard-screen--main"
              data-animate={shouldAnimateScreen}
              data-transition-direction={screenTransitionDirection}
            >
              <div className="cc-main-workspace">
                <div className="cc-main-workspace-primary">
                  <AddItemPanel
                    vehiclesState={vehiclesState}
                    existingItemIds={existingItemIds}
                    onAddItem={addItem}
                  />
                  <AddedItemsList
                    items={items}
                    onIncrementQuantity={incrementItemQuantity}
                    onDecrementQuantity={decrementItemQuantity}
                    onRequestRemove={setPendingRemovalId}
                  />
                </div>
                <aside className="cc-main-summary" aria-label="Resumen del cálculo">
                  <p className="cc-main-summary-heading">Resumen del cálculo</p>
                  <dl>
                    <div>
                      <dt>Unidades</dt>
                      <dd>{totalQuantity}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{formatUsd(totalPriceUsd)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="cc-apply-btn"
                    disabled={!hasItems}
                    onClick={(event) => changeScreen('config', 'forward', event.detail > 0)}
                  >
                    Continuar con la financiación
                  </button>
                </aside>
              </div>
              <footer className="cc-wizard-actions cc-main-mobile-actions">
                <span className="cc-wizard-total">Total: {formatUsd(totalPriceUsd)}</span>
                <button
                  type="button"
                  className="cc-apply-btn"
                  disabled={!hasItems}
                  onClick={(event) => changeScreen('config', 'forward', event.detail > 0)}
                >
                  Continuar con la financiación
                </button>
              </footer>
            </div>
          ) : null}

          {screen === 'config' ? (
            <div
              key={`config-${screenTransitionKey}`}
              className="cc-wizard-screen cc-wizard-screen--config"
              data-animate={shouldAnimateScreen}
              data-transition-direction={screenTransitionDirection}
            >
              <FinancingConfig
                value={draftConfig}
                totalPriceUsd={totalPriceUsd}
                onChange={setDraftConfig}
                onBack={(isPointerInitiated) =>
                  changeScreen('main', 'backward', isPointerInitiated)
                }
                onCalculate={calculatePlan}
              />
            </div>
          ) : null}

          {screen === 'result' ? (
            <div
              key={`result-${screenTransitionKey}`}
              className="cc-wizard-screen cc-wizard-screen--result"
              data-animate={shouldAnimateScreen}
              data-transition-direction={screenTransitionDirection}
            >
              <InstallmentSummary
                planResult={planResult}
                installmentPeriodicity={calculatedConfig.installmentPeriodicity}
                reinforcementPeriodicity={calculatedConfig.reinforcementPeriodicity}
              />
              <footer className="cc-wizard-actions">
                <button
                  type="button"
                  className="cc-secondary-action"
                  onClick={(event) => changeScreen('main', 'backward', event.detail > 0)}
                >
                  Editar unidades
                </button>
                <button
                  type="button"
                  className="cc-apply-btn"
                  onClick={(event) => changeScreen('config', 'backward', event.detail > 0)}
                >
                  Cambiar condiciones
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
