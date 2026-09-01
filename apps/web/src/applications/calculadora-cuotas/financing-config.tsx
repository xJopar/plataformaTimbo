import {
  MIN_DOWN_PAYMENT_PERCENT,
  PERIODICITY_LABELS,
  type CuotaPeriodicity,
  type DownPaymentMode,
  type PlazoMeses,
} from './installment-calculator';

const PLAZO_OPTIONS: PlazoMeses[] = [36, 48, 60];
const PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['mensual', 'semestral', 'anual'];

export interface FinancingConfigValue {
  downPaymentMode: DownPaymentMode;
  downPaymentPercent: number;
  downPaymentManualUsd: number;
  termMonths: PlazoMeses;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementsEnabled: boolean;
  reinforcementPeriodicity: CuotaPeriodicity;
}

export function isSameFinancingConfig(a: FinancingConfigValue, b: FinancingConfigValue): boolean {
  return (
    a.downPaymentMode === b.downPaymentMode &&
    a.downPaymentPercent === b.downPaymentPercent &&
    a.downPaymentManualUsd === b.downPaymentManualUsd &&
    a.termMonths === b.termMonths &&
    a.installmentPeriodicity === b.installmentPeriodicity &&
    a.reinforcementsEnabled === b.reinforcementsEnabled &&
    a.reinforcementPeriodicity === b.reinforcementPeriodicity
  );
}

interface FinancingConfigProps {
  value: FinancingConfigValue;
  totalPriceUsd: number;
  isDirty: boolean;
  onChange: (value: FinancingConfigValue) => void;
  onApply: () => void;
}

export function FinancingConfig({
  value,
  totalPriceUsd,
  isDirty,
  onChange,
  onApply,
}: FinancingConfigProps): React.JSX.Element {
  const hasItems = totalPriceUsd > 0;

  return (
    <section className="cc-section cc-config" aria-labelledby="cc-config-title">
      <div className="cc-section-heading">
        <h2 id="cc-config-title" className="cc-section-title">
          Financiación
        </h2>
        <button type="button" className="cc-apply-btn" disabled={!isDirty} onClick={onApply}>
          Calcular cuota
        </button>
      </div>

      {isDirty ? (
        <p className="cc-apply-hint" role="status">
          Cambios pendientes
        </p>
      ) : null}

      <div className="cc-total-row">
        <span className="cc-total-label">Precio total</span>
        <span className={`cc-total-value${hasItems ? '' : ' cc-total-value--empty'}`}>
          {hasItems
            ? `USD ${totalPriceUsd.toLocaleString('es-PY')}`
            : 'Agregá unidades para calcular'}
        </span>
      </div>

      <div className="cc-config-grid">
        <div className="cc-field-group">
          <div className="cc-field">
            <span className="cc-field-label">Plazo</span>
            <div className="cc-segmented" role="radiogroup" aria-label="Plazo en meses">
              {PLAZO_OPTIONS.map((months) => (
                <button
                  key={months}
                  type="button"
                  role="radio"
                  aria-checked={value.termMonths === months}
                  className={`cc-segmented-btn${value.termMonths === months ? ' cc-segmented-btn--active' : ''}`}
                  onClick={() => onChange({ ...value, termMonths: months })}
                >
                  {months} meses
                </button>
              ))}
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
              <>
                <div className="cc-inline-input">
                  <input
                    id="cc-down-payment-percent"
                    aria-label="Entrega inicial en porcentaje"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
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
                <span className="cc-field-hint">Mínimo {MIN_DOWN_PAYMENT_PERCENT}%.</span>
              </>
            ) : (
              <>
                <div className="cc-inline-input">
                  <span aria-hidden="true">USD</span>
                  <input
                    id="cc-down-payment-manual"
                    aria-label="Entrega inicial en dólares"
                    type="number"
                    min={0}
                    step={100}
                    value={value.downPaymentManualUsd}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        downPaymentManualUsd: Math.max(0, Number(event.target.value)),
                      })
                    }
                  />
                </div>
                <span className="cc-field-hint">
                  Debe representar al menos {MIN_DOWN_PAYMENT_PERCENT}% del precio total.
                </span>
              </>
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
              Incluir refuerzos
            </label>
            {value.reinforcementsEnabled ? (
              <select
                id="cc-reinforcement-periodicity"
                aria-label="Frecuencia de refuerzos"
                value={value.reinforcementPeriodicity}
                onChange={(event) =>
                  onChange({
                    ...value,
                    reinforcementPeriodicity: event.target.value as CuotaPeriodicity,
                  })
                }
              >
                {PERIODICITY_OPTIONS.map((periodicity) => (
                  <option key={periodicity} value={periodicity}>
                    {PERIODICITY_LABELS[periodicity]}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
