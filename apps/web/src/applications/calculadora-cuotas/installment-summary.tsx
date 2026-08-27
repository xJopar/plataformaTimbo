import { PERIODICITY_LABELS, type CuotaPeriodicity, type InstallmentPlan } from './installment-calculator';

function formatUsd(amount: number): string {
  return `USD ${amount.toLocaleString('es-PY')}`;
}

interface InstallmentSummaryProps {
  plan: InstallmentPlan | null;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementPeriodicity: CuotaPeriodicity;
}

export function InstallmentSummary({
  plan,
  installmentPeriodicity,
  reinforcementPeriodicity,
}: InstallmentSummaryProps): React.JSX.Element {
  return (
    <section className="cc-panel cc-cuotero" aria-labelledby="cc-cuotero-title">
      <div className="cc-panel-heading">
        <h2 id="cc-cuotero-title" className="cc-panel-title">
          Cuotero
        </h2>
        <span className="cc-provisional-badge">Cálculo provisorio</span>
      </div>

      {plan === null ? (
        <p className="cc-added-empty">
          Agregá al menos una unidad o un precio manual para ver el cuotero.
        </p>
      ) : (
        <>
          <p className="cc-cuotero-note">
            Los montos usan un reparto lineal sin interés, sólo para probar el flujo. Se van a
            reemplazar por la tabla de interés y la regla de redondeo reales apenas estén definidas.
          </p>
          <dl className="cc-cuotero-list">
            <div className="cc-cuotero-row">
              <dt>Entrega inicial</dt>
              <dd>{formatUsd(plan.downPaymentUsd)}</dd>
            </div>
            <div className="cc-cuotero-row cc-cuotero-row--highlight">
              <dt>
                Cuota (redondeada) × {plan.regularInstallmentCount} cuotas regulares
                <span className="cc-cuotero-periodicity">
                  {PERIODICITY_LABELS[installmentPeriodicity]}
                </span>
              </dt>
              <dd>{formatUsd(plan.regularInstallmentAmountUsd)}</dd>
            </div>
            {plan.reinforcementCount > 0 ? (
              <div className="cc-cuotero-row">
                <dt>
                  Refuerzo (redondeado) × {plan.reinforcementCount} refuerzos
                  <span className="cc-cuotero-periodicity">
                    {PERIODICITY_LABELS[reinforcementPeriodicity]}
                  </span>
                </dt>
                <dd>{formatUsd(plan.reinforcementAmountUsd)}</dd>
              </div>
            ) : null}
          </dl>
        </>
      )}
    </section>
  );
}
