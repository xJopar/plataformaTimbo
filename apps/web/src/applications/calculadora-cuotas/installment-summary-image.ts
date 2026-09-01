import {
  PERIODICITY_ADJECTIVE_PLURAL,
  type CuotaPeriodicity,
  type InstallmentPlan,
} from './installment-calculator';

const IMAGE_WIDTH = 800;
const IMAGE_SCALE = 2;
const IMAGE_HORIZONTAL_PADDING = 56;
const IMAGE_VERTICAL_PADDING = 52;
// Altura del plan sin refuerzo ni cuota de redondeo, incluida la respiración inferior.
const IMAGE_BASE_HEIGHT = 672;
const BRAND_BLUE = '#00388a';
const INK = '#142033';
const MUTED_INK = '#475569';
const BORDER = '#bcc9d7';

function formatUsd(amount: number): string {
  return `USD ${amount.toLocaleString('es-PY', { maximumFractionDigits: 0 })}`;
}

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  weight: 400 | 600 | 700 | 800,
): void {
  context.font = `${String(weight)} ${String(size)}px Aptos, "Segoe UI", sans-serif`;
}

function drawRule(context: CanvasRenderingContext2D, y: number): void {
  context.strokeStyle = BORDER;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(IMAGE_HORIZONTAL_PADDING, y);
  context.lineTo(IMAGE_WIDTH - IMAGE_HORIZONTAL_PADDING, y);
  context.stroke();
}

function drawAmountRow(
  context: CanvasRenderingContext2D,
  y: number,
  label: string,
  amount: string,
): number {
  setFont(context, 17, 600);
  context.fillStyle = MUTED_INK;
  context.fillText(label, IMAGE_HORIZONTAL_PADDING, y);
  setFont(context, 17, 700);
  context.fillStyle = INK;
  context.textAlign = 'right';
  context.fillText(amount, IMAGE_WIDTH - IMAGE_HORIZONTAL_PADDING, y);
  context.textAlign = 'left';
  return y + 38;
}

function drawHero(
  context: CanvasRenderingContext2D,
  y: number,
  label: string,
  amount: string,
): number {
  setFont(context, 17, 600);
  context.fillStyle = MUTED_INK;
  context.fillText(label, IMAGE_HORIZONTAL_PADDING, y);
  setFont(context, 33, 800);
  context.fillStyle = BRAND_BLUE;
  context.fillText(amount, IMAGE_HORIZONTAL_PADDING, y + 40);
  return y + 82;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('El navegador no pudo generar la imagen del cuotero.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export interface InstallmentSummaryImageInput {
  plan: InstallmentPlan;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementPeriodicity: CuotaPeriodicity;
}

/** Genera una lámina autónoma del plan: el PNG no replica los controles de la aplicación. */
export async function downloadInstallmentSummaryImage({
  plan,
  installmentPeriodicity,
  reinforcementPeriodicity,
}: InstallmentSummaryImageInput): Promise<void> {
  const hasReinforcements = plan.reinforcementCount > 0;
  const hasAdjustmentInstallment = plan.hasAdjustmentInstallment;
  const imageHeight =
    IMAGE_BASE_HEIGHT + (hasReinforcements ? 38 : 0) + (hasAdjustmentInstallment ? 82 : 0);
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH * IMAGE_SCALE;
  canvas.height = imageHeight * IMAGE_SCALE;

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('El navegador no permite crear la imagen del cuotero.');
  }
  context.scale(IMAGE_SCALE, IMAGE_SCALE);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, IMAGE_WIDTH, imageHeight);
  context.fillStyle = BRAND_BLUE;
  context.fillRect(0, 0, IMAGE_WIDTH, 6);

  let y = IMAGE_VERTICAL_PADDING;
  setFont(context, 17, 800);
  context.fillStyle = BRAND_BLUE;
  context.fillText('TIMBO', IMAGE_HORIZONTAL_PADDING, y);
  setFont(context, 16, 600);
  context.fillStyle = MUTED_INK;
  context.fillText('Calculadora de Cuotas', IMAGE_HORIZONTAL_PADDING + 82, y);

  y += 54;
  setFont(context, 28, 800);
  context.fillStyle = INK;
  context.fillText('Cuotero', IMAGE_HORIZONTAL_PADDING, y);
  y += 32;
  setFont(context, 14, 700);
  context.fillStyle = MUTED_INK;
  context.fillText('PLAN DE PAGOS', IMAGE_HORIZONTAL_PADDING, y);
  y += 42;

  y = drawAmountRow(
    context,
    y,
    `Entrega inicial · ${String(Math.round(plan.downPaymentPercent))}%`,
    formatUsd(plan.downPaymentUsd),
  );
  y = drawHero(
    context,
    y,
    `${String(plan.regularInstallmentCount)} cuotas ${PERIODICITY_ADJECTIVE_PLURAL[installmentPeriodicity]} de`,
    formatUsd(plan.regularInstallmentAmountUsd),
  );
  if (hasReinforcements) {
    y = drawAmountRow(
      context,
      y,
      `${String(plan.reinforcementCount)} refuerzos ${PERIODICITY_ADJECTIVE_PLURAL[reinforcementPeriodicity]} de`,
      formatUsd(plan.reinforcementAmountUsd),
    );
  }
  if (hasAdjustmentInstallment) {
    y = drawHero(context, y, 'Cuota redondeo', formatUsd(plan.adjustmentInstallmentAmountUsd));
  }

  drawRule(context, y + 4);
  y = drawHero(context, y + 44, 'Total a pagar', formatUsd(plan.totalPagarUsd));
  drawRule(context, y + 2);
  y += 44;

  setFont(context, 14, 700);
  context.fillStyle = MUTED_INK;
  context.fillText('DETALLES DEL FINANCIAMIENTO', IMAGE_HORIZONTAL_PADDING, y);
  y += 36;
  y = drawAmountRow(context, y, 'Tasa anual', `${plan.annualRatePercent.toLocaleString('es-PY')}%`);
  y = drawAmountRow(context, y, 'Intereses', formatUsd(plan.interestTotalUsd));
  drawAmountRow(context, y, 'Total financiado con intereses', formatUsd(plan.saldoAFinanciarUsd));

  const imageBlob = await canvasToBlob(canvas);
  const imageUrl = URL.createObjectURL(imageBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = imageUrl;
  downloadLink.download = 'cuotero-timbo.png';
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(imageUrl);
  }, 0);
}
