import {
  formatUsd,
  PERIODICITY_LABELS,
  type CuotaPeriodicity,
  type DownPaymentMode,
} from './installment-calculator';

const PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['mensual', 'semestral', 'anual'];
const REINFORCEMENT_PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['semestral', 'anual'];

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
  onBack: (isPointerInitiated: boolean) => void;
  onCalculate: (isPointerInitiated: boolean) => void;
  onChange: (value: FinancingConfigValue) => void;
}

function positiveInteger(value: string): number {
  return Math.max(1, Math.floor(Number(value) || 1));
}

export function FinancingConfig({
  value,
  totalPriceUsd,
  onBack,
  onCalculate,
  onChange,
}: FinancingConfigProps): React.JSX.Element {
  return (
    <section className="cc-section cc-config" aria-labelledby="cc-config-title">
      <div className="cc-section-heading">
        <div>
          <h2 id="cc-config-title" className="cc-section-title">
            Configurá la financiación
          </h2>
          <p className="cc-section-description">
            Definí las condiciones del plan antes de calcularlo.
          </p>
        </div>
        <span className="cc-total-value">{formatUsd(totalPriceUsd)}</span>
      </div>

      <div className="cc-config-grid">
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
            <span className="cc-field-label">Entrega inicial</span>
            <div className="cc-segmented" role="radiogroup" aria-label="Modo de entrega inicial">
              <button
                type="button"
                role="radio"
                aria-checked={value.downPaymentMode === 'percent'}
                className={`cc-segmented-btn${value.downPaymentMode === 'percent' ? ' cc-segmented-btn--active' : ''}`}
                onClick={() => onChange({ ...value, downPaymentMode: 'percent' })}
              >
                Porcentaje
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={value.downPaymentMode === 'manual'}
                className={`cc-segmented-btn${value.downPaymentMode === 'manual' ? ' cc-segmented-btn--active' : ''}`}
                onClick={() => onChange({ ...value, downPaymentMode: 'manual' })}
              >
                Monto manual
              </button>
            </div>
            {value.downPaymentMode === 'percent' ? (
              <div className="cc-inline-input">
                <input
                  id="cc-down-payment-percent"
                  aria-label="Entrega inicial en porcentaje"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={value.downPaymentPercent}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      downPaymentPercent: Math.min(100, Math.max(0, Number(event.target.value))),
                    })
                  }
                />
                <span aria-hidden="true">%</span>
              </div>
            ) : (
              <div className="cc-inline-input">
                <input
                  id="cc-down-payment-manual"
                  aria-label="Entrega inicial en dólares"
                  type="number"
                  min={0}
                  step={0.01}
                  value={value.downPaymentManualUsd}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      downPaymentManualUsd: Math.max(0, Number(event.target.value)),
                    })
                  }
                />
                <span aria-hidden="true">USD</span>
              </div>
            )}
          </div>
        </div>

        <div className="cc-field-group">
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
            {value.reinforcementsEnabled ? (
              <>
                <label htmlFor="cc-desired-regular-installment">Monto de cada cuota regular</label>
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
                        desiredRegularInstallmentAmountUsd: Math.max(0, Number(event.target.value)),
                      })
                    }
                  />
                  <span aria-hidden="true">USD</span>
                </div>
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
              </>
            ) : null}
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
