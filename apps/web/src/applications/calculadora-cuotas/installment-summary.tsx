import {
  PERIODICITY_ADJECTIVE_PLURAL,
  type CuotaPeriodicity,
  type InstallmentPlanResult,
} from './installment-calculator';
import { ImageDownloadIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { AppIcon } from '../../ui/app-icon';
import { downloadInstallmentSummaryImage } from './installment-summary-image';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFailure, setDownloadFailure] = useState<string | undefined>(undefined);

  async function downloadSummaryImage(): Promise<void> {
    if (planResult.status !== 'ok' || isDownloading) return;
    setIsDownloading(true);
    setDownloadFailure(undefined);
    try {
      await downloadInstallmentSummaryImage({
        plan: planResult.plan,
        installmentPeriodicity,
        reinforcementPeriodicity,
      });
    } catch (error: unknown) {
      setDownloadFailure('No pudimos generar la imagen. Intentá descargarla nuevamente.');
      console.error('No se pudo descargar la imagen del cuotero.', {
        operation: 'download-installment-summary-image',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDownloading(false);
    }
  }

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
        {planResult.status === 'ok' ? (
          <button
            type="button"
            className="cc-download-image-btn"
            disabled={isDownloading}
            onClick={downloadSummaryImage}
          >
            <AppIcon icon={ImageDownloadIcon} size={22} strokeWidth={1.8} />
            <span>{isDownloading ? 'Generando imagen…' : 'Descargar imagen'}</span>
          </button>
        ) : null}
      </div>

      {downloadFailure === undefined ? null : (
        <p className="cc-cuotero-error" role="alert">
          {downloadFailure}
        </p>
      )}

      {planResult.status === 'empty' ? (
        <p className="cc-added-empty">
          Agregá al menos una unidad o un precio manual para ver el cuotero.
        </p>
      ) : planResult.status === 'down-payment-too-low' ? (
        <p className="cc-cuotero-error" role="alert">
          La entrega inicial debe ser de al menos {planResult.minPercent}% del precio total: la
          tabla de tasas no cubre entregas menores. Aumentá la entrega para poder calcular.
        </p>
      ) : planResult.status === 'invalid-term-reinforcement-combination' ? (
        <p className="cc-cuotero-error" role="alert">
          Esa combinación de plazo y frecuencia de refuerzos no deja cuotas regulares disponibles.
          Cambiá el plazo o la frecuencia de refuerzos.
        </p>
      ) : planResult.status === 'regular-installment-negative' ? (
        <p className="cc-cuotero-error" role="alert">
          El monto de la cuota regular quedó negativo o en cero. Revisá el monto de los refuerzos o
          el plazo.
        </p>
      ) : (
        (() => {
          const { plan } = planResult;
          return (
            <>
              <p className="cc-cuotero-kicker">Plan de pagos</p>

              <dl className="cc-cuotero-list">
                <div className="cc-cuotero-row">
                  <dt>Entrega inicial · {Math.round(plan.downPaymentPercent)}%</dt>
                  <dd>{formatUsd(plan.downPaymentUsd)}</dd>
                </div>
              </dl>

              <div className="cc-cuotero-hero">
                <span className="cc-cuotero-hero-label">
                  {plan.regularInstallmentCount} cuotas{' '}
                  {PERIODICITY_ADJECTIVE_PLURAL[installmentPeriodicity]} de
                </span>
                <strong className="cc-cuotero-hero-value">
                  {formatUsd(plan.regularInstallmentAmountUsd)}
                </strong>
              </div>

              {plan.reinforcementCount > 0 ? (
                <dl className="cc-cuotero-list">
                  <div className="cc-cuotero-row">
                    <dt>
                      {plan.reinforcementCount} refuerzos{' '}
                      {PERIODICITY_ADJECTIVE_PLURAL[reinforcementPeriodicity]} de
                    </dt>
                    <dd>{formatUsd(plan.reinforcementAmountUsd)}</dd>
                  </div>
                </dl>
              ) : null}

              {plan.hasAdjustmentInstallment ? (
                <div className="cc-cuotero-hero">
                  <span className="cc-cuotero-hero-label">Cuota redondeo</span>
                  <strong className="cc-cuotero-hero-value">
                    {formatUsd(plan.adjustmentInstallmentAmountUsd)}
                  </strong>
                </div>
              ) : null}

              <div className="cc-cuotero-hero cc-cuotero-hero--total">
                <span className="cc-cuotero-hero-label">Total a pagar</span>
                <strong className="cc-cuotero-hero-value">{formatUsd(plan.totalPagarUsd)}</strong>
              </div>

              <div className="cc-cuotero-secondary">
                <p className="cc-cuotero-kicker">Detalles del financiamiento</p>
                <dl className="cc-cuotero-detail-list">
                  <div className="cc-cuotero-detail-row">
                    <dt>Tasa anual</dt>
                    <dd>{plan.annualRatePercent.toLocaleString('es-PY')}%</dd>
                  </div>
                  <div className="cc-cuotero-detail-row">
                    <dt>Intereses</dt>
                    <dd>{formatUsd(plan.interestTotalUsd)}</dd>
                  </div>
                  <div className="cc-cuotero-detail-row">
                    <dt>Total financiado con intereses</dt>
                    <dd>{formatUsd(plan.saldoAFinanciarUsd)}</dd>
                  </div>
                </dl>
              </div>
            </>
          );
        })()
      )}
    </section>
  );
}
