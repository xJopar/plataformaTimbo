import {
  formatUsd,
  PERIODICITY_LABELS,
  type CuotaPeriodicity,
  type DownPaymentMode,
} from './installment-calculator';

const PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['mensual', 'semestral', 'anual'];
const REINFORCEMENT_PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['semestral', 'anual'];
const MAX_PERCENTAGE = 100;

export interface FinancingConfigValue {
  downPaymentMode: DownPaymentMode;
  downPaymentPercent: number;
  downPaymentManualUsd: number;
  termMonths: number;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementsEnabled: boolean;
  reinforcementPeriodicity: CuotaPeriodicity;
  desiredRegularInstallmentAmountUsd: number;
}

interface FinancingConfigProps {
  value: FinancingConfigValue;
  totalPriceUsd: number;
  totalQuantity: number;
  onBack: (isPointerInitiated: boolean) => void;
  onCalculate: (isPointerInitiated: boolean) => void;
  onChange: (value: FinancingConfigValue) => void;
}

function positiveInteger(value: string): number {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function clampDownPayment(value: number, totalPriceUsd: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), totalPriceUsd);
}

function roundUsd(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getDownPaymentUsd(value: FinancingConfigValue, totalPriceUsd: number): number {
  const rawAmount =
    value.downPaymentMode === 'manual'
      ? value.downPaymentManualUsd
      : (totalPriceUsd * value.downPaymentPercent) / MAX_PERCENTAGE;

  return roundUsd(clampDownPayment(rawAmount, totalPriceUsd));
}

function getDownPaymentPercent(downPaymentUsd: number, totalPriceUsd: number): number {
  if (totalPriceUsd <= 0) return 0;
  return (downPaymentUsd / totalPriceUsd) * MAX_PERCENTAGE;
}

function formatPercent(percent: number): string {
  return `${percent.toLocaleString('es-PY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function parseUsdInput(value: string): number {
  const acceptedCharacters = value.replace(/[^\d.,]/g, '');
  const decimalSeparatorIndex = acceptedCharacters.indexOf(',');
  const integerPart = (
    decimalSeparatorIndex === -1
      ? acceptedCharacters
      : acceptedCharacters.slice(0, decimalSeparatorIndex)
  ).replace(/\D/g, '');
  const decimalPart =
    decimalSeparatorIndex === -1
      ? ''
      : acceptedCharacters
          .slice(decimalSeparatorIndex + 1)
          .replace(/\D/g, '')
          .slice(0, 2);
  const normalizedValue = decimalPart === '' ? integerPart : `${integerPart || '0'}.${decimalPart}`;
  const parsedValue = Number(normalizedValue || 0);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function FinancingConfig({
  value,
  totalPriceUsd,
  totalQuantity,
  onBack,
  onCalculate,
  onChange,
}: FinancingConfigProps): React.JSX.Element {
  const normalizedTotalPriceUsd = Number.isFinite(totalPriceUsd) ? Math.max(0, totalPriceUsd) : 0;
  const downPaymentUsd = getDownPaymentUsd(value, normalizedTotalPriceUsd);
  const downPaymentPercent = getDownPaymentPercent(downPaymentUsd, normalizedTotalPriceUsd);
  const financedBalanceUsd = normalizedTotalPriceUsd - downPaymentUsd;

  function changeDownPaymentPercent(nextPercent: number): void {
    const normalizedPercent = Number.isFinite(nextPercent)
      ? Math.min(Math.max(nextPercent, 0), MAX_PERCENTAGE)
      : 0;
    const nextDownPaymentUsd = roundUsd(
      (normalizedTotalPriceUsd * normalizedPercent) / MAX_PERCENTAGE,
    );

    onChange({
      ...value,
      downPaymentMode: 'percent',
      downPaymentPercent: normalizedPercent,
      downPaymentManualUsd: nextDownPaymentUsd,
    });
  }

  function changeDownPaymentManualUsd(inputValue: string): void {
    const nextDownPaymentUsd = roundUsd(
      clampDownPayment(parseUsdInput(inputValue), normalizedTotalPriceUsd),
    );

    onChange({
      ...value,
      downPaymentMode: 'manual',
      downPaymentManualUsd: nextDownPaymentUsd,
      downPaymentPercent: getDownPaymentPercent(nextDownPaymentUsd, normalizedTotalPriceUsd),
    });
  }

  return (
    <section className="cc-section cc-config" aria-labelledby="cc-config-title">
      <div className="cc-section-heading">
        <div>
          <h2 id="cc-config-title" className="cc-section-title">
            Definí las condiciones
          </h2>
          <p className="cc-section-description">
            Ajustá la entrega y las condiciones del plan antes de calcularlo.
          </p>
        </div>
      </div>

      <div className="cc-config-layout">
        <aside className="cc-config-summary" aria-label="Resumen de la financiación">
          <p className="cc-config-summary-heading">Resumen</p>
          <dl>
            <div>
              <dt>Unidades</dt>
              <dd>{totalQuantity}</dd>
            </div>
            <div className="cc-config-summary-total">
              <dt>Precio total</dt>
              <dd>{formatUsd(normalizedTotalPriceUsd)}</dd>
            </div>
            <div>
              <dt>Entrega inicial</dt>
              <dd>{formatUsd(downPaymentUsd)}</dd>
            </div>
            <div className="cc-config-summary-balance">
              <dt>Saldo a financiar</dt>
              <dd>{formatUsd(financedBalanceUsd)}</dd>
            </div>
          </dl>
        </aside>

        <div className="cc-config-controls">
          <fieldset className="cc-down-payment">
            <legend>Entrega inicial</legend>
            <div className="cc-down-payment-overview">
              <p>Porcentaje de entrega</p>
              <output className="cc-down-payment-percent">
                {formatPercent(downPaymentPercent)}
              </output>
            </div>
            <label className="cc-sr-only" htmlFor="cc-down-payment-percent">
              Porcentaje de entrega inicial
            </label>
            <input
              id="cc-down-payment-percent"
              className="cc-down-payment-slider"
              type="range"
              min={0}
              max={MAX_PERCENTAGE}
              step={0.01}
              value={downPaymentPercent.toFixed(2)}
              aria-valuetext={`${formatPercent(downPaymentPercent)} · ${formatUsd(downPaymentUsd)}`}
              onChange={(event) => changeDownPaymentPercent(Number(event.target.value))}
            />
            <div className="cc-down-payment-slider-scale" aria-hidden="true">
              <span>0 %</span>
              <span>100 %</span>
            </div>
            <div className="cc-field cc-down-payment-amount">
              <label htmlFor="cc-down-payment-manual">Monto de entrega</label>
              <div className="cc-inline-input">
                <input
                  id="cc-down-payment-manual"
                  aria-describedby="cc-down-payment-hint"
                  type="text"
                  inputMode="decimal"
                  value={formatUsd(downPaymentUsd)}
                  onChange={(event) => changeDownPaymentManualUsd(event.target.value)}
                />
              </div>
              <p id="cc-down-payment-hint" className="cc-field-hint">
                Ingresá un importe con hasta dos decimales.
              </p>
            </div>
            <output className="cc-sr-only" aria-live="polite" aria-atomic="true">
              Entrega inicial actualizada: {formatPercent(downPaymentPercent)},{' '}
              {formatUsd(downPaymentUsd)}. Saldo a financiar: {formatUsd(financedBalanceUsd)}.
            </output>
          </fieldset>

          <div className="cc-config-settings">
            <div className="cc-field-group">
              <div className="cc-field">
                <label htmlFor="cc-term-months">Plazo en meses</label>
                <div className="cc-inline-input">
                  <input
                    id="cc-term-months"
                    type="number"
                    min={1}
                    step={1}
                    value={value.termMonths}
                    onChange={(event) =>
                      onChange({ ...value, termMonths: positiveInteger(event.target.value) })
                    }
                  />
                  <span aria-hidden="true">meses</span>
                </div>
              </div>

              <div className="cc-field">
                <label htmlFor="cc-installment-periodicity">Frecuencia de pago</label>
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

            <div className="cc-field-group cc-field-group--reinforcements">
              <div className="cc-field">
                <label className="cc-checkbox-field" htmlFor="cc-reinforcements-enabled">
                  <input
                    id="cc-reinforcements-enabled"
                    type="checkbox"
                    checked={value.reinforcementsEnabled}
                    onChange={(event) =>
                      onChange({ ...value, reinforcementsEnabled: event.target.checked })
                    }
                  />
                  Calcular con refuerzos
                </label>
              </div>
              {value.reinforcementsEnabled ? (
                <>
                  <div className="cc-field">
                    <label htmlFor="cc-desired-regular-installment">
                      Monto de cada cuota regular
                    </label>
                    <div className="cc-inline-input">
                      <input
                        id="cc-desired-regular-installment"
                        type="number"
                        min={0}
                        step={0.01}
                        value={value.desiredRegularInstallmentAmountUsd}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            desiredRegularInstallmentAmountUsd: Math.max(
                              0,
                              Number(event.target.value),
                            ),
                          })
                        }
                      />
                      <span aria-hidden="true">USD</span>
                    </div>
                  </div>
                  <div className="cc-field">
                    <label htmlFor="cc-reinforcement-periodicity">Frecuencia de refuerzos</label>
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
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <footer className="cc-wizard-actions">
        <button
          type="button"
          className="cc-secondary-action"
          onClick={(event) => onBack(event.detail > 0)}
        >
          Volver a unidades
        </button>
        <button
          type="button"
          className="cc-apply-btn"
          onClick={(event) => onCalculate(event.detail > 0)}
        >
          Calcular plan
        </button>
      </footer>
    </section>
  );
}
