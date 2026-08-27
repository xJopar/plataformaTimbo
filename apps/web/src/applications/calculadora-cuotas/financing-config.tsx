import { PERIODICITY_LABELS, type CuotaPeriodicity, type PlazoMeses } from './installment-calculator';

const PLAZO_OPTIONS: PlazoMeses[] = [36, 48, 60];
const PERIODICITY_OPTIONS: CuotaPeriodicity[] = ['mensual', 'semestral', 'anual'];

export interface FinancingConfigValue {
  downPaymentPercent: number;
  termMonths: PlazoMeses;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementPeriodicity: CuotaPeriodicity;
}

interface FinancingConfigProps {
  value: FinancingConfigValue;
  totalPriceUsd: number;
  onChange: (value: FinancingConfigValue) => void;
}

export function FinancingConfig({
  value,
  totalPriceUsd,
  onChange,
}: FinancingConfigProps): React.JSX.Element {
  const hasItems = totalPriceUsd > 0;

  return (
    <section className="cc-panel" aria-labelledby="cc-config-title">
      <h2 id="cc-config-title" className="cc-panel-title">
        Precio final y condiciones
      </h2>

      <div className="cc-total-row">
        <span className="cc-total-label">Precio final</span>
        <span className="cc-total-value">
          {hasItems
            ? `USD ${totalPriceUsd.toLocaleString('es-PY')}`
            : 'Agregá unidades para calcular'}
        </span>
      </div>

      <div className="cc-config-grid">
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
          <label htmlFor="cc-down-payment">Entrega inicial</label>
          <div className="cc-percent-input">
            <input
              id="cc-down-payment"
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
        </div>

        <div className="cc-field">
          <label htmlFor="cc-installment-periodicity">Periodicidad de cuotas regulares</label>
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
            {PERIODICITY_OPTIONS.map((periodicity) => (
              <option key={periodicity} value={periodicity}>
                {PERIODICITY_LABELS[periodicity]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
