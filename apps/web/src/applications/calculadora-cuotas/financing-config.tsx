import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  calculateInstallmentPlan,
  formatUsd,
  getAnnualRatePercent,
  PERIODICITY_LABELS,
  type CalculationMode,
  type CalculatorItem,
  type CuotaPeriodicity,
  type DownPaymentMode,
  type InstallmentPlanResult,
} from './installment-calculator';
import { InitialDownPaymentField } from './initial-down-payment-field';
import { InterestRateInfo } from './interest-rate-info';
import { ReinforcementSwitch } from './reinforcement-switch';

const PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['mensual', 'semestral', 'anual'];
const REINFORCEMENT_PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['semestral', 'anual'];

export interface FinancingConfigValue {
  calculationMode: CalculationMode;
  downPaymentMode: DownPaymentMode;
  downPaymentPercent: number;
  downPaymentManualUsd: number;
  termMonths: number;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementsEnabled: boolean;
  reinforcementPeriodicity: CuotaPeriodicity;
  reinforcementAmountUsd: number;
  desiredRegularInstallmentAmountUsd: number;
  customAnnualRateEnabled: boolean;
  customAnnualRatePercent?: number;
}

interface FinancingConfigProps {
  items: CalculatorItem[];
  value: FinancingConfigValue;
  totalPriceUsd: number;
  totalQuantity: number;
  onBack: (isPointerInitiated: boolean) => void;
  onCalculate: (nextValue: FinancingConfigValue, isPointerInitiated: boolean) => void;
  onChange: (value: FinancingConfigValue) => void;
}

type InvalidField =
  | 'downPayment'
  | 'reinforcementAmount'
  | 'reinforcementPeriodicity'
  | 'targetInstallment'
  | 'termMonths'
  | 'annualRate';

interface CalculationError {
  fields: readonly InvalidField[];
  message: string;
}

function getCalculationError(
  result: Exclude<InstallmentPlanResult, { status: 'ok' }>,
  calculationMode: CalculationMode,
): CalculationError {
  switch (result.status) {
    case 'empty':
      return {
        fields: [],
        message: 'Agregá al menos una unidad o un precio manual antes de calcular.',
      };
    case 'invalid-term-reinforcement-combination':
      return {
        fields: ['termMonths', 'reinforcementPeriodicity'],
        message:
          'Esa combinación de plazo y frecuencia de refuerzos no deja cuotas regulares disponibles. Cambiá el plazo o la frecuencia de refuerzos.',
      };
    case 'reinforcement-installment-required':
      return calculationMode === 'standard'
        ? {
            fields: ['reinforcementAmount'],
            message: 'Ingresá el monto de cada refuerzo para continuar.',
          }
        : {
            fields: ['targetInstallment'],
            message: 'Ingresá el monto de cuota objetivo para continuar.',
          };
    case 'reinforcement-amount-negative':
      return calculationMode === 'standard'
        ? {
            fields: ['reinforcementAmount'],
            message:
              'El total de refuerzos supera el saldo financiado. Reducí su monto o cambiá las condiciones.',
          }
        : {
            fields: ['targetInstallment'],
            message:
              'El total de cuotas regulares supera el saldo financiado. Reducí el monto de la cuota o cambiá las condiciones.',
          };
    case 'regular-installment-negative':
      return {
        fields: ['downPayment'],
        message: 'No queda saldo para distribuir en cuotas. Revisá la entrega inicial y el plazo.',
      };
  }
}

function parseDecimal(value: string): number | undefined {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (normalized === '') return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatEditableUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return value.toLocaleString('es-PY', { maximumFractionDigits: 2 });
}

function formatEditablePercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) return '';
  return value.toLocaleString('es-PY', { maximumFractionDigits: 2 });
}

function formatWhileTyping(value: string): string {
  const allowed = value.replace(/[^\d.,]/g, '');
  const commaPosition = allowed.lastIndexOf(',');
  const dotPosition = allowed.lastIndexOf('.');
  const separatorPosition = Math.max(commaPosition, dotPosition);
  const hasDecimal = separatorPosition >= 0 && allowed.length - separatorPosition - 1 <= 2;
  const integerDigits = (hasDecimal ? allowed.slice(0, separatorPosition) : allowed).replace(
    /\D/g,
    '',
  );
  const decimalDigits = hasDecimal
    ? allowed
        .slice(separatorPosition + 1)
        .replace(/\D/g, '')
        .slice(0, 2)
    : '';
  const integer = integerDigits === '' ? '' : Number(integerDigits).toLocaleString('es-PY');
  return hasDecimal ? `${integer},${decimalDigits}` : integer;
}

export function FinancingConfig({
  items,
  value,
  totalPriceUsd,
  totalQuantity,
  onBack,
  onCalculate,
  onChange,
}: FinancingConfigProps): React.JSX.Element {
  const normalizedTotalPriceUsd = Number.isFinite(totalPriceUsd) ? Math.max(0, totalPriceUsd) : 0;
  const downPaymentUsd =
    value.downPaymentMode === 'manual'
      ? value.downPaymentManualUsd
      : (normalizedTotalPriceUsd * value.downPaymentPercent) / 100;
  const normalizedDownPaymentUsd = Math.min(Math.max(downPaymentUsd, 0), normalizedTotalPriceUsd);
  const financedBalanceUsd = normalizedTotalPriceUsd - normalizedDownPaymentUsd;
  const [termInput, setTermInput] = useState(String(value.termMonths));
  const [reinforcementAmountInput, setReinforcementAmountInput] = useState(
    formatEditableUsd(value.reinforcementAmountUsd),
  );
  const [targetInstallmentInput, setTargetInstallmentInput] = useState(
    formatEditableUsd(value.desiredRegularInstallmentAmountUsd),
  );
  const [annualRateInput, setAnnualRateInput] = useState(
    formatEditablePercent(value.customAnnualRatePercent),
  );
  const [calculationError, setCalculationError] = useState<CalculationError | undefined>(undefined);

  useEffect(() => setTermInput(String(value.termMonths)), [value.termMonths]);
  useEffect(
    () => setReinforcementAmountInput(formatEditableUsd(value.reinforcementAmountUsd)),
    [value.reinforcementAmountUsd],
  );
  useEffect(
    () => setTargetInstallmentInput(formatEditableUsd(value.desiredRegularInstallmentAmountUsd)),
    [value.desiredRegularInstallmentAmountUsd],
  );
  useEffect(
    () => setAnnualRateInput(formatEditablePercent(value.customAnnualRatePercent)),
    [value.customAnnualRatePercent],
  );

  function updateTerm(nextInput: string): void {
    setCalculationError(undefined);
    const formatted = nextInput.replace(/\D/g, '');
    setTermInput(formatted);
    const parsed = Number(formatted);
    if (Number.isInteger(parsed) && parsed > 0) onChange({ ...value, termMonths: parsed });
  }

  function updateMoney(
    nextInput: string,
    update: (amount: number) => FinancingConfigValue,
    setInput: (input: string) => void,
  ): void {
    setCalculationError(undefined);
    const formatted = formatWhileTyping(nextInput);
    setInput(formatted);
    const parsed = parseDecimal(formatted);
    if (parsed !== undefined && parsed >= 0) onChange(update(parsed));
  }

  function reportCalculationError(error: CalculationError): void {
    setCalculationError(error);
    toast.error(error.message);
  }

  function reportInvalidField(message: string, fields: readonly InvalidField[]): void {
    const error = { message, fields };
    setCalculationError(error);
    toast.error(message);
  }

  function handleCalculate(event: React.MouseEvent<HTMLButtonElement>): void {
    const termMonths = Number(termInput);
    if (!Number.isInteger(termMonths) || termMonths < 1) {
      reportInvalidField('Ingresá un plazo de al menos un mes.', ['termMonths']);
      return;
    }

    const reinforcementAmountUsd = parseDecimal(reinforcementAmountInput) ?? 0;
    const desiredRegularInstallmentAmountUsd = parseDecimal(targetInstallmentInput) ?? 0;
    const customAnnualRatePercent = parseDecimal(annualRateInput);
    if (
      value.calculationMode === 'standard' &&
      value.reinforcementsEnabled &&
      reinforcementAmountUsd <= 0
    ) {
      reportInvalidField('Ingresá el monto de cada refuerzo para continuar.', [
        'reinforcementAmount',
      ]);
      return;
    }
    if (value.calculationMode === 'target-installment' && desiredRegularInstallmentAmountUsd <= 0) {
      reportInvalidField('Ingresá el monto de cuota objetivo para continuar.', [
        'targetInstallment',
      ]);
      return;
    }
    if (
      value.customAnnualRateEnabled &&
      (customAnnualRatePercent === undefined || customAnnualRatePercent < 0)
    ) {
      reportInvalidField('Ingresá una tasa de interés válida para continuar.', ['annualRate']);
      return;
    }

    const nextValue = {
      ...value,
      termMonths,
      reinforcementAmountUsd,
      desiredRegularInstallmentAmountUsd,
      customAnnualRatePercent: value.customAnnualRateEnabled
        ? customAnnualRatePercent
        : value.customAnnualRatePercent,
    };
    const result = calculateInstallmentPlan({ items, ...nextValue });
    if (result.status !== 'ok') {
      reportCalculationError(getCalculationError(result, value.calculationMode));
      return;
    }

    setCalculationError(undefined);
    onCalculate(nextValue, event.detail > 0);
  }

  const isTargetInstallment = value.calculationMode === 'target-installment';

  return (
    <section className="cc-section cc-config" aria-labelledby="cc-config-title">
      <div className="cc-config-heading">
        <h2 id="cc-config-title" className="cc-section-title">
          Condiciones
        </h2>
      </div>

      <div className="cc-config-layout">
        <div className="cc-config-controls">
          {isTargetInstallment ? (
            <fieldset className="cc-field-group">
              <legend>Monto de cuota objetivo</legend>
              <div className="cc-field cc-field--important cc-target-installment-field">
                <div
                  className={
                    calculationError?.fields.includes('targetInstallment')
                      ? 'cc-input-with-suffix cc-input-error'
                      : 'cc-input-with-suffix'
                  }
                >
                  <input
                    id="cc-desired-regular-installment"
                    aria-label="Monto de cuota objetivo"
                    className={
                      calculationError?.fields.includes('targetInstallment')
                        ? 'cc-input-error'
                        : undefined
                    }
                    aria-invalid={
                      calculationError?.fields.includes('targetInstallment') || undefined
                    }
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={targetInstallmentInput}
                    onChange={(event) =>
                      updateMoney(
                        event.target.value,
                        (amount) => ({ ...value, desiredRegularInstallmentAmountUsd: amount }),
                        setTargetInstallmentInput,
                      )
                    }
                  />
                  <span aria-hidden="true">USD</span>
                </div>
              </div>
            </fieldset>
          ) : null}

          <div className="cc-field-group cc-payment-conditions">
            <div className="cc-config-inline-fields">
              <div className="cc-field">
                <label htmlFor="cc-term-months">Plazo en meses</label>
                <input
                  id="cc-term-months"
                  className={
                    calculationError?.fields.includes('termMonths') ? 'cc-input-error' : undefined
                  }
                  aria-invalid={calculationError?.fields.includes('termMonths') || undefined}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={termInput}
                  onChange={(event) => updateTerm(event.target.value)}
                />
              </div>
              <div className="cc-field">
                <label htmlFor="cc-installment-periodicity">Periodicidad</label>
                <select
                  id="cc-installment-periodicity"
                  className={
                    calculationError?.fields.includes('termMonths') ? 'cc-input-error' : undefined
                  }
                  aria-invalid={calculationError?.fields.includes('termMonths') || undefined}
                  value={value.installmentPeriodicity}
                  onChange={(event) => {
                    setCalculationError(undefined);
                    onChange({
                      ...value,
                      installmentPeriodicity: event.target.value as CuotaPeriodicity,
                    });
                  }}
                >
                  {PERIODICITY_OPTIONS.map((periodicity) => (
                    <option key={periodicity} value={periodicity}>
                      {PERIODICITY_LABELS[periodicity]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isTargetInstallment ? (
            <fieldset className="cc-field-group">
              <legend>Refuerzos</legend>
              <div className="cc-config-inline-fields">
                <div className="cc-field">
                  <label htmlFor="cc-reinforcement-periodicity">Periodicidad de refuerzos</label>
                  <select
                    id="cc-reinforcement-periodicity"
                    className={
                      calculationError?.fields.includes('reinforcementPeriodicity')
                        ? 'cc-input-error'
                        : undefined
                    }
                    aria-invalid={
                      calculationError?.fields.includes('reinforcementPeriodicity') || undefined
                    }
                    value={value.reinforcementPeriodicity}
                    onChange={(event) => {
                      setCalculationError(undefined);
                      onChange({
                        ...value,
                        reinforcementPeriodicity: event.target.value as CuotaPeriodicity,
                      });
                    }}
                  >
                    {REINFORCEMENT_PERIODICITY_OPTIONS.map((periodicity) => (
                      <option key={periodicity} value={periodicity}>
                        {PERIODICITY_LABELS[periodicity]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          ) : (
            <fieldset
              className="cc-field-group cc-reinforcements-disclosure"
              aria-labelledby="cc-reinforcements-title"
            >
              <div className="cc-reinforcements-heading">
                <span id="cc-reinforcements-title" className="cc-reinforcements-title">
                  Refuerzos
                </span>
                <ReinforcementSwitch
                  checked={value.reinforcementsEnabled}
                  onChange={(reinforcementsEnabled) => {
                    setCalculationError(undefined);
                    onChange({ ...value, reinforcementsEnabled });
                  }}
                  activateLabel="Activar refuerzos"
                  deactivateLabel="Desactivar refuerzos"
                />
              </div>
              {value.reinforcementsEnabled ? (
                <div className="cc-config-inline-fields cc-reinforcements-fields">
                  <div className="cc-field">
                    <label htmlFor="cc-reinforcement-periodicity">Periodicidad de refuerzos</label>
                    <select
                      id="cc-reinforcement-periodicity"
                      className={
                        calculationError?.fields.includes('reinforcementPeriodicity')
                          ? 'cc-input-error'
                          : undefined
                      }
                      aria-invalid={
                        calculationError?.fields.includes('reinforcementPeriodicity') || undefined
                      }
                      value={value.reinforcementPeriodicity}
                      onChange={(event) => {
                        setCalculationError(undefined);
                        onChange({
                          ...value,
                          reinforcementPeriodicity: event.target.value as CuotaPeriodicity,
                        });
                      }}
                    >
                      {REINFORCEMENT_PERIODICITY_OPTIONS.map((periodicity) => (
                        <option key={periodicity} value={periodicity}>
                          {PERIODICITY_LABELS[periodicity]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cc-field">
                    <label htmlFor="cc-reinforcement-amount">Monto de cada refuerzo</label>
                    <div
                      className={
                        calculationError?.fields.includes('reinforcementAmount')
                          ? 'cc-input-with-suffix cc-input-error'
                          : 'cc-input-with-suffix'
                      }
                    >
                      <input
                        id="cc-reinforcement-amount"
                        className={
                          calculationError?.fields.includes('reinforcementAmount')
                            ? 'cc-input-error'
                            : undefined
                        }
                        aria-invalid={
                          calculationError?.fields.includes('reinforcementAmount') || undefined
                        }
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={reinforcementAmountInput}
                        onChange={(event) =>
                          updateMoney(
                            event.target.value,
                            (amount) => ({ ...value, reinforcementAmountUsd: amount }),
                            setReinforcementAmountInput,
                          )
                        }
                      />
                      <span aria-hidden="true">USD</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </fieldset>
          )}

          <InitialDownPaymentField
            value={value}
            totalPriceUsd={normalizedTotalPriceUsd}
            onChange={onChange}
            hasCalculationError={calculationError?.fields.includes('downPayment') === true}
            onEdit={() => setCalculationError(undefined)}
          />
          <fieldset
            className="cc-field-group cc-reinforcements-disclosure cc-interest-rate-disclosure"
            aria-labelledby="cc-interest-rate-title"
          >
            <div className="cc-reinforcements-heading">
              <span id="cc-interest-rate-title" className="cc-reinforcements-title">
                Editar interés
              </span>
              <div className="cc-interest-rate-actions">
                <InterestRateInfo />
                <ReinforcementSwitch
                  checked={value.customAnnualRateEnabled}
                  onChange={(customAnnualRateEnabled) => {
                    setCalculationError(undefined);
                    onChange({
                      ...value,
                      customAnnualRateEnabled,
                      customAnnualRatePercent:
                        customAnnualRateEnabled && value.customAnnualRatePercent === undefined
                          ? getAnnualRatePercent(
                              Math.max(1, value.termMonths),
                              normalizedTotalPriceUsd === 0
                                ? 0
                                : (normalizedDownPaymentUsd / normalizedTotalPriceUsd) * 100,
                            )
                          : value.customAnnualRatePercent,
                    });
                  }}
                  activateLabel="Activar edición de interés"
                  deactivateLabel="Desactivar edición de interés"
                />
              </div>
            </div>
            {value.customAnnualRateEnabled ? (
              <div className="cc-interest-rate-field cc-field">
                <label htmlFor="cc-custom-annual-rate">Tasa anual</label>
                <div
                  className={
                    calculationError?.fields.includes('annualRate')
                      ? 'cc-input-with-suffix cc-input-error'
                      : 'cc-input-with-suffix'
                  }
                >
                  <input
                    id="cc-custom-annual-rate"
                    className={
                      calculationError?.fields.includes('annualRate') ? 'cc-input-error' : undefined
                    }
                    aria-invalid={calculationError?.fields.includes('annualRate') || undefined}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={annualRateInput}
                    onChange={(event) => {
                      setCalculationError(undefined);
                      const formatted = formatWhileTyping(event.target.value);
                      setAnnualRateInput(formatted);
                      const parsed = parseDecimal(formatted);
                      if (parsed !== undefined && parsed >= 0) {
                        onChange({ ...value, customAnnualRatePercent: parsed });
                      }
                    }}
                  />
                  <span aria-hidden="true">%</span>
                </div>
              </div>
            ) : null}
          </fieldset>
          {calculationError === undefined ? null : (
            <p className="cc-field-error" role="alert">
              {calculationError.message}
            </p>
          )}
        </div>

        <aside className="cc-config-summary" aria-label="Resumen de la financiación">
          <p className="cc-config-summary-heading">Resumen de financiación</p>
          <dl>
            <div>
              <dt>Unidades</dt>
              <dd>{totalQuantity}</dd>
            </div>
            <div>
              <dt>Precio total</dt>
              <dd>{formatUsd(normalizedTotalPriceUsd)}</dd>
            </div>
            <div>
              <dt>Entrega inicial</dt>
              <dd>{formatUsd(normalizedDownPaymentUsd)}</dd>
            </div>
            <div className="cc-config-summary-balance">
              <dt>Saldo a financiar</dt>
              <dd>{formatUsd(financedBalanceUsd)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <footer className="cc-wizard-actions">
        <button
          type="button"
          className="cc-secondary-action"
          onClick={(event) => onBack(event.detail > 0)}
        >
          Volver a modalidad
        </button>
        <button type="button" className="cc-apply-btn" onClick={handleCalculate}>
          Calcular plan
        </button>
      </footer>
    </section>
  );
}
