import {
  PERIODICITY_ADJECTIVE_PLURAL,
  type CuotaPeriodicity,
  type InstallmentPlan,
} from './installment-calculator';

const IMAGE_WIDTH = 760;
const IMAGE_SCALE = 2;
const IMAGE_HORIZONTAL_PADDING = 48;
const HEADER_HEIGHT = 96;
const IMAGE_BASE_HEIGHT = 730;
const BRAND_BLUE = '#00388a';
const INK = '#142033';
const MUTED_INK = '#475569';
const BORDER = '#bcc9d7';
const SECONDARY_SURFACE = '#f7f9fb';
const BRAND_LOGO_SOURCE = '/marca/logotipo-timbo-blanco-transparente.webp';

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
  setFont(context, 18, 700);
  context.fillStyle = INK;
  context.textAlign = 'right';
  context.fillText(amount, IMAGE_WIDTH - IMAGE_HORIZONTAL_PADDING, y);
  context.textAlign = 'left';
  return y + 38;
}

function drawSupportingAmount(
  context: CanvasRenderingContext2D,
  y: number,
  label: string,
  amount: string,
): number {
  setFont(context, 17, 600);
  context.fillStyle = MUTED_INK;
  context.fillText(label, IMAGE_HORIZONTAL_PADDING, y);
  setFont(context, 28, 700);
  context.fillStyle = INK;
  context.fillText(amount, IMAGE_HORIZONTAL_PADDING, y + 38);
  return y + 76;
}

function drawRegularInstallment(
  context: CanvasRenderingContext2D,
  y: number,
  label: string,
  amount: string,
): number {
  setFont(context, 18, 600);
  context.fillStyle = MUTED_INK;
  context.fillText(label, IMAGE_HORIZONTAL_PADDING, y);
  setFont(context, 58, 800);
  context.fillStyle = BRAND_BLUE;
  context.fillText(amount, IMAGE_HORIZONTAL_PADDING, y + 66);
  return y + 112;
}

function drawTotal(context: CanvasRenderingContext2D, y: number, amount: string): number {
  drawRule(context, y);
  setFont(context, 18, 600);
  context.fillStyle = MUTED_INK;
  context.fillText('Total a pagar', IMAGE_HORIZONTAL_PADDING, y + 48);
  setFont(context, 36, 800);
  context.fillStyle = BRAND_BLUE;
  context.fillText(amount, IMAGE_HORIZONTAL_PADDING, y + 92);
  return y + 132;
}

function loadBrandLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const logo = document.createElement('img');
    logo.addEventListener(
      'load',
      () => {
        resolve(logo);
      },
      { once: true },
    );
    logo.addEventListener(
      'error',
      () => {
        reject(new Error('No se pudo cargar el logotipo de TIMBO para la imagen del cuotero.'));
      },
      { once: true },
    );
    logo.src = BRAND_LOGO_SOURCE;
  });
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

/** Genera una cotización de TIMBO lista para compartir, sin controles de la aplicación. */
export async function downloadInstallmentSummaryImage({
  plan,
  installmentPeriodicity,
  reinforcementPeriodicity,
}: InstallmentSummaryImageInput): Promise<void> {
  const brandLogo = await loadBrandLogo();
  const hasReinforcements = plan.reinforcementCount > 0;
  const hasAdjustmentInstallment = plan.hasAdjustmentInstallment;
  const imageHeight =
    IMAGE_BASE_HEIGHT + (hasReinforcements ? 38 : 0) + (hasAdjustmentInstallment ? 76 : 0);
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
  context.fillRect(0, 0, IMAGE_WIDTH, HEADER_HEIGHT);
  setFont(context, 20, 700);
  context.fillStyle = '#ffffff';
  context.fillText('PLAN DE PAGOS', IMAGE_HORIZONTAL_PADDING, 61);
  context.drawImage(brandLogo, 250, 27, 168, 42);

  let y = HEADER_HEIGHT + 54;
  y = drawAmountRow(
    context,
    y,
    `Entrega inicial · ${String(Math.round(plan.downPaymentPercent))}%`,
    formatUsd(plan.downPaymentUsd),
  );

  if (hasAdjustmentInstallment) {
    y = drawSupportingAmount(
      context,
      y + 30,
      'Cuota redondeo',
      formatUsd(plan.adjustmentInstallmentAmountUsd),
    );
  }

  y = drawRegularInstallment(
    context,
    y + 28,
    `${String(plan.regularInstallmentCount)} cuotas ${PERIODICITY_ADJECTIVE_PLURAL[installmentPeriodicity]} de`,
    formatUsd(plan.regularInstallmentAmountUsd),
  );

  if (hasReinforcements) {
    y = drawAmountRow(
      context,
      y + 30,
      `${String(plan.reinforcementCount)} refuerzos ${PERIODICITY_ADJECTIVE_PLURAL[reinforcementPeriodicity]} de`,
      formatUsd(plan.reinforcementAmountUsd),
    );
  }

  y = drawTotal(context, y + 30, formatUsd(plan.totalPagarUsd));
  drawRule(context, y);
  y += 48;

  context.fillStyle = SECONDARY_SURFACE;
  context.fillRect(0, y - 28, IMAGE_WIDTH, imageHeight - y + 28);
  setFont(context, 16, 700);
  context.fillStyle = INK;
  context.fillText('Detalle del financiamiento', IMAGE_HORIZONTAL_PADDING, y);
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
