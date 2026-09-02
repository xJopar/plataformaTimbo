import { ImageDownloadIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { AppIcon } from '../../ui/app-icon';
import {
  formatUsd,
  PERIODICITY_ADJECTIVE_PLURAL,
  type CuotaPeriodicity,
  type InstallmentPlanResult,
} from './installment-calculator';
import { downloadInstallmentSummaryImage } from './installment-summary-image';

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
    <section className="cc-section cc-cuotero" aria-labelledby="cc-cuotero-title">
      <div className="cc-section-heading">
        <div>
          <h2 id="cc-cuotero-title" className="cc-section-title">
            Plan calculado
          </h2>
          <p className="cc-section-description">
            Compartí el resumen o volvé a ajustar las condiciones.
          </p>
        </div>
      </div>

      {downloadFailure === undefined ? null : (
        <p className="cc-cuotero-error" role="alert">
          {downloadFailure}
        </p>
      )}

      {planResult.status === 'empty' ? (
        <p className="cc-cuotero-error" role="alert">
          Agregá al menos una unidad o un precio manual antes de calcular.
        </p>
      ) : planResult.status === 'invalid-term-reinforcement-combination' ? (
        <p className="cc-cuotero-error" role="alert">
          Esa combinación de plazo y frecuencia de refuerzos no deja cuotas regulares disponibles.
          Cambiá el plazo o la frecuencia de refuerzos.
        </p>
      ) : planResult.status === 'reinforcement-installment-required' ? (
        <p className="cc-cuotero-error" role="alert">
          Indicá el monto que el cliente quiere pagar en cada cuota regular para calcular los
          refuerzos.
        </p>
      ) : planResult.status === 'reinforcement-amount-negative' ? (
        <p className="cc-cuotero-error" role="alert">
          El total de cuotas regulares supera el saldo financiado. Reducí el monto de la cuota o
          cambiá la configuración.
        </p>
      ) : planResult.status === 'regular-installment-negative' ? (
        <p className="cc-cuotero-error" role="alert">
          No queda saldo para distribuir en cuotas. Revisá la entrega inicial y el plazo.
        </p>
      ) : (
        (() => {
          const { plan } = planResult;
          return (
            <>
              <dl className="cc-cuotero-list">
                <div className="cc-cuotero-row">
                  <dt>
                    Entrega inicial ·{' '}
                    {plan.downPaymentPercent.toLocaleString('es-PY', { maximumFractionDigits: 2 })}%
                  </dt>
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

              <div className="cc-cuotero-hero cc-cuotero-hero--total">
                <span className="cc-cuotero-hero-label">Total a pagar</span>
                <strong className="cc-cuotero-hero-value">{formatUsd(plan.totalPagarUsd)}</strong>
              </div>

              <div className="cc-cuotero-secondary" aria-label="Detalle del cálculo">
                <dl className="cc-cuotero-detail-list">
                  <div className="cc-cuotero-detail-row">
                    <dt>Tasa de interés aplicada</dt>
                    <dd>{plan.annualRatePercent.toLocaleString('es-PY')}%</dd>
                  </div>
                  <div className="cc-cuotero-detail-row">
                    <dt>Intereses</dt>
                    <dd>{formatUsd(plan.interestTotalUsd)}</dd>
                  </div>
                </dl>
              </div>
            </>
          );
        })()
      )}

      {planResult.status === 'ok' ? (
        <footer className="cc-cuotero-footer">
          <button
            type="button"
            className="cc-download-image-btn"
            disabled={isDownloading}
            onClick={downloadSummaryImage}
          >
            <AppIcon icon={ImageDownloadIcon} size={22} strokeWidth={1.8} />
            <span>{isDownloading ? 'Generando imagen…' : 'Descargar cuotero como imagen'}</span>
          </button>
        </footer>
      ) : null}
    </section>
  );
}
