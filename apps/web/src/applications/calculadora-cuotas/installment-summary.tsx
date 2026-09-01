import {
  PERIODICITY_LABELS,
  type CuotaPeriodicity,
  type InstallmentPlanResult,
} from './installment-calculator';

function formatUsd(amount: number): string {
  return `USD ${amount.toLocaleString('es-PY', { maximumFractionDigits: 0 })}`;
}

interface InstallmentSummaryProps {
  planResult: InstallmentPlanResult;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementPeriodicity: CuotaPeriodicity;
}

export function InstallmentSummary({
  planResult,
  installmentPeriodicity,
  reinforcementPeriodicity,
}: InstallmentSummaryProps): React.JSX.Element {
  return (
    <section
      id="cc-cuotero-section"
      tabIndex={-1}
      className="cc-section cc-cuotero"
      aria-labelledby="cc-cuotero-title"
    >
      <div className="cc-section-heading">
        <h2 id="cc-cuotero-title" className="cc-section-title">
          Cuotero
        </h2>
      </div>

      {planResult.status === 'empty' ? (
        <p className="cc-added-empty">
          Agregá al menos una unidad o un precio manual para ver el cuotero.
        </p>
      ) : planResult.status === 'down-payment-too-low' ? (
        <p className="cc-cuotero-error" role="alert">
          La entrega inicial debe ser de al menos {planResult.minPercent}% del precio final: la
          tabla de tasas no cubre entregas menores. Aumentá la entrega para poder calcular.
        </p>
      ) : planResult.status === 'invalid-term-reinforcement-combination' ? (
        <p className="cc-cuotero-error" role="alert">
          Esa combinación de plazo y periodicidad de refuerzos no deja cuotas regulares
          disponibles. Cambiá el plazo o la periodicidad de refuerzos.
        </p>
      ) : planResult.status === 'regular-installment-negative' ? (
        <p className="cc-cuotero-error" role="alert">
          El monto de la cuota regular quedó negativo o en cero. Revisá el monto de los refuerzos
          o el plazo.
        </p>
      ) : (
        (() => {
          const { plan } = planResult;
          return (
            <>
              <dl className="cc-cuotero-list">
                <div className="cc-cuotero-row">
                  <dt>Entrega inicial ({plan.downPaymentPercent.toFixed(1)}%)</dt>
                  <dd>{formatUsd(plan.downPaymentUsd)}</dd>
                </div>
                <div className="cc-cuotero-row">
                  <dt>Tasa anual aplicada</dt>
                  <dd>{plan.annualRatePercent.toLocaleString('es-PY')}%</dd>
                </div>
                <div className="cc-cuotero-row">
                  <dt>Interés total del plazo</dt>
                  <dd>{formatUsd(plan.interestTotalUsd)}</dd>
                </div>
                <div className="cc-cuotero-row">
                  <dt>Saldo a financiar (capital + interés)</dt>
                  <dd>{formatUsd(plan.saldoAFinanciarUsd)}</dd>
                </div>
                <div className="cc-cuotero-row cc-cuotero-row--highlight">
                  <dt>
                    Cuota regular × {plan.regularInstallmentCount} cuotas
                    <span className="cc-cuotero-periodicity">
                      {PERIODICITY_LABELS[installmentPeriodicity]}
                    </span>
                  </dt>
                  <dd>{formatUsd(plan.regularInstallmentAmountUsd)}</dd>
                </div>
                {plan.hasAdjustmentInstallment ? (
                  <div className="cc-cuotero-row">
                    <dt>Cuota de ajuste (redondeo) × 1</dt>
                    <dd>{formatUsd(plan.adjustmentInstallmentAmountUsd)}</dd>
                  </div>
                ) : null}
                {plan.reinforcementCount > 0 ? (
                  <div className="cc-cuotero-row">
                    <dt>
                      Refuerzo × {plan.reinforcementCount} refuerzos
                      <span className="cc-cuotero-periodicity">
                        {PERIODICITY_LABELS[reinforcementPeriodicity]}
                      </span>
                    </dt>
                    <dd>{formatUsd(plan.reinforcementAmountUsd)}</dd>
                  </div>
                ) : null}
                <div className="cc-cuotero-row cc-cuotero-row--highlight">
                  <dt>Total a pagar (entrega + refuerzos + cuotas)</dt>
                  <dd>{formatUsd(plan.totalPagarUsd)}</dd>
                </div>
              </dl>
              <p className="cc-cuotero-note">
                Monto de refuerzo aún provisorio: la regla de negocio para definirlo todavía no
                está confirmada.
              </p>
            </>
          );
        })()
      )}
    </section>
  );
}
