import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  formatUsd,
  PERIODICITY_LABELS,
  type CalculationMode,
  type CuotaPeriodicity,
  type DownPaymentMode,
} from './installment-calculator';
import { InitialDownPaymentField } from './initial-down-payment-field';
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
}

interface FinancingConfigProps {
  value: FinancingConfigValue;
  totalPriceUsd: number;
  totalQuantity: number;
  onBack: (isPointerInitiated: boolean) => void;
  onChangeMode: (isPointerInitiated: boolean) => void;
  onCalculate: (nextValue: FinancingConfigValue, isPointerInitiated: boolean) => void;
  onChange: (value: FinancingConfigValue) => void;
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
  value,
  totalPriceUsd,
  totalQuantity,
  onBack,
  onChangeMode,
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
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  useEffect(() => setTermInput(String(value.termMonths)), [value.termMonths]);
  useEffect(
    () => setReinforcementAmountInput(formatEditableUsd(value.reinforcementAmountUsd)),
    [value.reinforcementAmountUsd],
  );
  useEffect(
    () => setTargetInstallmentInput(formatEditableUsd(value.desiredRegularInstallmentAmountUsd)),
    [value.desiredRegularInstallmentAmountUsd],
  );

  function updateTerm(nextInput: string): void {
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
    const formatted = formatWhileTyping(nextInput);
    setInput(formatted);
    const parsed = parseDecimal(formatted);
    if (parsed !== undefined && parsed >= 0) onChange(update(parsed));
  }

  function reportInvalidField(message: string): void {
    setFieldError(message);
    toast.error(message);
  }

  function handleCalculate(event: React.MouseEvent<HTMLButtonElement>): void {
    const termMonths = Number(termInput);
    if (!Number.isInteger(termMonths) || termMonths < 1) {
      reportInvalidField('Ingresá un plazo de al menos un mes.');
      return;
    }

    const reinforcementAmountUsd = parseDecimal(reinforcementAmountInput) ?? 0;
    const desiredRegularInstallmentAmountUsd = parseDecimal(targetInstallmentInput) ?? 0;
    if (
      value.calculationMode === 'standard' &&
      value.reinforcementsEnabled &&
      reinforcementAmountUsd <= 0
    ) {
      reportInvalidField('Ingresá el monto de cada refuerzo para continuar.');
      return;
    }
    if (value.calculationMode === 'target-installment' && desiredRegularInstallmentAmountUsd <= 0) {
      reportInvalidField('Ingresá el monto de cuota objetivo para continuar.');
      return;
    }

    setFieldError(undefined);
    onCalculate(
      { ...value, termMonths, reinforcementAmountUsd, desiredRegularInstallmentAmountUsd },
      event.detail > 0,
    );
  }

  const isTargetInstallment = value.calculationMode === 'target-installment';

  return (
    <section className="cc-section cc-config" aria-labelledby="cc-config-title">
      <div className="cc-config-heading">
        <h2 id="cc-config-title" className="cc-section-title">
          Condiciones
        </h2>
        <button
          type="button"
          className="cc-change-mode"
          onClick={(event) => onChangeMode(event.detail > 0)}
        >
          Cambiar modalidad
        </button>
      </div>

      <div className="cc-config-layout">
        <div className="cc-config-controls">
          <fieldset className="cc-field-group cc-payment-conditions">
            <legend>Pago regular</legend>
            <div className="cc-config-inline-fields">
              <div className="cc-field">
                <label htmlFor="cc-term-months">Plazo en meses</label>
                <input
                  id="cc-term-months"
                  className={fieldError?.includes('plazo') ? 'cc-input-error' : undefined}
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
                  value={value.installmentPeriodicity}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      installmentPeriodicity: event.target.value as CuotaPeriodicity,
                    })
                  }
                >
                  {PERIODICITY_OPTIONS.map((periodicity) => (
                    <option key={periodicity} value={periodicity}>
                      {PERIODICITY_LABELS[periodicity]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {isTargetInstallment ? (
            <fieldset className="cc-field-group">
              <legend>Refuerzos</legend>
              <div className="cc-config-inline-fields">
                <div className="cc-field">
                  <label htmlFor="cc-reinforcement-periodicity">Periodicidad de refuerzos</label>
                  <select
                    id="cc-reinforcement-periodicity"
                    value={value.reinforcementPeriodicity}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        reinforcementPeriodicity: event.target.value as CuotaPeriodicity,
                      })
                    }
                  >
                    {REINFORCEMENT_PERIODICITY_OPTIONS.map((periodicity) => (
                      <option key={periodicity} value={periodicity}>
                        {PERIODICITY_LABELS[periodicity]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cc-field cc-field--important">
                  <label htmlFor="cc-desired-regular-installment">Monto de cuota objetivo</label>
                  <div className="cc-input-with-suffix">
                    <input
                      id="cc-desired-regular-installment"
                      className={
                        fieldError?.includes('cuota objetivo') ? 'cc-input-error' : undefined
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
                  onChange={(reinforcementsEnabled) =>
                    onChange({ ...value, reinforcementsEnabled })
                  }
                />
              </div>
              {value.reinforcementsEnabled ? (
                <div className="cc-config-inline-fields cc-reinforcements-fields">
                  <div className="cc-field">
                    <label htmlFor="cc-reinforcement-periodicity">Periodicidad de refuerzos</label>
                    <select
                      id="cc-reinforcement-periodicity"
                      value={value.reinforcementPeriodicity}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          reinforcementPeriodicity: event.target.value as CuotaPeriodicity,
                        })
                      }
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
                    <div className="cc-input-with-suffix">
                      <input
                        id="cc-reinforcement-amount"
                        className={
                          fieldError?.includes('cada refuerzo') ? 'cc-input-error' : undefined
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
          />
          {fieldError === undefined ? null : (
            <p className="cc-field-error" role="alert">
              {fieldError}
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
