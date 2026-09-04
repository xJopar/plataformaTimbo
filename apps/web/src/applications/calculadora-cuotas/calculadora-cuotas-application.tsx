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
import { CalculationModeSelector } from './calculation-mode-selector';
import { ConfirmCalculationModeDialog } from './confirm-calculation-mode-dialog';
import { ConfirmRemoveDialog } from './confirm-remove-dialog';
import { FinancingConfig, type FinancingConfigValue } from './financing-config';
import { InstallmentSummary } from './installment-summary';
import {
  calculateInstallmentPlan,
  formatUsd,
  sumItemsUsd,
  type CalculationMode,
  type CalculatorItem,
} from './installment-calculator';
import { parseCalculadoraCuotasRoute } from './calculadora-cuotas-routes';

const DEFAULT_CONFIG: FinancingConfigValue = {
  calculationMode: 'standard',
  downPaymentMode: 'percent',
  downPaymentPercent: 20,
  downPaymentManualUsd: 0,
  termMonths: 36,
  installmentPeriodicity: 'mensual',
  reinforcementsEnabled: false,
  reinforcementPeriodicity: 'semestral',
  reinforcementAmountUsd: 0,
  desiredRegularInstallmentAmountUsd: 0,
};

type WizardScreen = 'main' | 'mode' | 'config' | 'result';

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
  const [selectedCalculationMode, setSelectedCalculationMode] = useState<
    CalculationMode | undefined
  >(undefined);
  const [hasChosenCalculationMode, setHasChosenCalculationMode] = useState(false);
  const [pendingCalculationMode, setPendingCalculationMode] = useState<CalculationMode | undefined>(
    undefined,
  );
  const [pendingRemovalId, setPendingRemovalId] = useState<string | undefined>(undefined);
  const preloadHandled = useRef(false);
  const [screenTransitionDirection, setScreenTransitionDirection] = useState<
    'forward' | 'backward'
  >('forward');
  const [shouldAnimateScreen, setShouldAnimateScreen] = useState(false);
  const [screenTransitionKey, setScreenTransitionKey] = useState(0);

  const route = useMemo(
    () => parseCalculadoraCuotasRoute(pathname, application.launchPath),
    [pathname, application.launchPath],
  );

  useEffect(() => {
    if (route.view !== 'from-stock' || preloadHandled.current || vehiclesState.status !== 'ready')
      return;
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
      requestAnimationFrame(() =>
        toast.info(`Se agregó ${group.name} (stock ${unit.stock}) desde Lista de Precios.`),
      );
      return;
    }
    requestAnimationFrame(() =>
      toast.info('No encontramos esa unidad en el catálogo actual de Lista de Precios.'),
    );
  }, [route, vehiclesState]);

  const existingItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const totalPriceUsd = useMemo(() => sumItemsUsd(items), [items]);
  const totalQuantity = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );
  const planResult = useMemo(
    () => calculateInstallmentPlan({ items, ...calculatedConfig }),
    [items, calculatedConfig],
  );
  const pendingRemovalItem = items.find((item) => item.id === pendingRemovalId);

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

  function openModeSelection(isPointerInitiated: boolean, fromConditions: boolean): void {
    setSelectedCalculationMode(fromConditions ? draftConfig.calculationMode : undefined);
    changeScreen('mode', fromConditions ? 'backward' : 'forward', isPointerInitiated);
  }

  function applyCalculationMode(mode: CalculationMode, isPointerInitiated: boolean): void {
    if (mode === draftConfig.calculationMode && hasChosenCalculationMode) {
      changeScreen('config', 'forward', isPointerInitiated);
      return;
    }
    const downPayment = {
      downPaymentMode: draftConfig.downPaymentMode,
      downPaymentPercent: draftConfig.downPaymentPercent,
      downPaymentManualUsd: draftConfig.downPaymentManualUsd,
    };
    const nextConfig: FinancingConfigValue = {
      ...DEFAULT_CONFIG,
      ...downPayment,
      calculationMode: mode,
      reinforcementsEnabled: mode === 'target-installment',
    };
    setDraftConfig(nextConfig);
    setHasChosenCalculationMode(true);
    changeScreen('config', 'forward', isPointerInitiated);
  }

  function continueModeSelection(isPointerInitiated: boolean): void {
    if (selectedCalculationMode === undefined) return;
    if (hasChosenCalculationMode && selectedCalculationMode !== draftConfig.calculationMode) {
      setPendingCalculationMode(selectedCalculationMode);
      return;
    }
    applyCalculationMode(selectedCalculationMode, isPointerInitiated);
  }

  function calculatePlan(nextConfig: FinancingConfigValue, isPointerInitiated: boolean): void {
    setDraftConfig(nextConfig);
    setCalculatedConfig(nextConfig);
    changeScreen('result', 'forward', isPointerInitiated);
  }

  const activeStep = screen === 'main' ? 1 : screen === 'mode' ? 2 : screen === 'config' ? 3 : 4;
  const stepLabels = ['Unidades', 'Modalidad', 'Condiciones', 'Plan final'];

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
        <div className="cc-wizard">
          <ol className="cc-wizard-steps" aria-label="Flujo de cálculo">
            {stepLabels.map((label, index) => {
              const step = index + 1;
              const status =
                step === activeStep ? 'active' : step < activeStep ? 'complete' : 'pending';
              return (
                <li
                  key={label}
                  className={
                    status === 'active'
                      ? 'cc-wizard-step--active'
                      : status === 'complete'
                        ? 'cc-wizard-step--complete'
                        : undefined
                  }
                  aria-current={status === 'active' ? 'step' : undefined}
                >
                  <span className="cc-wizard-step-marker" aria-hidden="true">
                    {status === 'complete' ? '✓' : step}
                  </span>
                  <span>{label}</span>
                  <span className="cc-sr-only">
                    {status === 'active'
                      ? 'Actual.'
                      : status === 'complete'
                        ? 'Completado.'
                        : 'Pendiente.'}
                  </span>
                </li>
              );
            })}
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
                    disabled={items.length === 0}
                    onClick={(event) => openModeSelection(event.detail > 0, false)}
                  >
                    Continuar con financiación
                  </button>
                </aside>
              </div>
            </div>
          ) : null}

          {screen === 'mode' ? (
            <div
              key={`mode-${screenTransitionKey}`}
              className="cc-wizard-screen"
              data-animate={shouldAnimateScreen}
              data-transition-direction={screenTransitionDirection}
            >
              <CalculationModeSelector
                selectedMode={selectedCalculationMode}
                onSelect={setSelectedCalculationMode}
                onBack={(isPointerInitiated) =>
                  changeScreen('main', 'backward', isPointerInitiated)
                }
                onContinue={continueModeSelection}
              />
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
                totalQuantity={totalQuantity}
                onChange={setDraftConfig}
                onBack={(isPointerInitiated) => openModeSelection(isPointerInitiated, true)}
                onChangeMode={(isPointerInitiated) => openModeSelection(isPointerInitiated, true)}
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
                calculationMode={calculatedConfig.calculationMode}
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
      <ConfirmCalculationModeDialog
        mode={pendingCalculationMode}
        onCancel={() => setPendingCalculationMode(undefined)}
        onConfirm={() => {
          if (pendingCalculationMode !== undefined)
            applyCalculationMode(pendingCalculationMode, true);
          setPendingCalculationMode(undefined);
        }}
      />
    </main>
  );
}
