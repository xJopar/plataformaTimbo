import {
  formatUsd,
  PERIODICITY_ADJECTIVE_PLURAL,
  type CalculatorItem,
  type CuotaPeriodicity,
  type InstallmentPlan,
} from './installment-calculator';

const IMAGE_WIDTH = 760;
const IMAGE_SCALE = 2;
const IMAGE_HORIZONTAL_PADDING = 48;
const HEADER_HEIGHT = 96;
const ITEM_LINE_HEIGHT = 28;
const ITEM_GAP = 10;
const BRAND_BLUE = '#00388a';
const INK = '#142033';
const MUTED_INK = '#475569';
const BORDER = '#bcc9d7';
const BRAND_LOGO_SOURCE = '/marca/logotipo-timbo-blanco-transparente.webp';

interface ReceiptItem {
  lines: string[];
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

function drawSectionLabel(context: CanvasRenderingContext2D, y: number, label: string): number {
  setFont(context, 14, 800);
  context.fillStyle = MUTED_INK;
  context.fillText(label, IMAGE_HORIZONTAL_PADDING, y);
  return y + 34;
}

function splitLongWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
): string[] {
  const parts: string[] = [];
  let part = '';

  for (const character of word) {
    const nextPart = `${part}${character}`;
    if (part !== '' && context.measureText(nextPart).width > maxWidth) {
      parts.push(part);
      part = character;
      continue;
    }
    part = nextPart;
  }

  if (part !== '') parts.push(part);
  return parts;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['Unidad sin descripción'];

  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if (context.measureText(word).width > maxWidth) {
      if (line !== '') {
        lines.push(line);
        line = '';
      }
      lines.push(...splitLongWord(context, word, maxWidth));
      continue;
    }

    const nextLine = line === '' ? word : `${line} ${word}`;
    if (context.measureText(nextLine).width <= maxWidth) {
      line = nextLine;
      continue;
    }

    lines.push(line);
    line = word;
  }

  if (line !== '') lines.push(line);
  return lines;
}

export function formatReceiptItemLabel(item: Pick<CalculatorItem, 'label' | 'quantity'>): string {
  const label = item.label.trim() || 'Unidad sin descripción';
  const quantity = Number.isFinite(item.quantity) ? Math.max(1, Math.trunc(item.quantity)) : 1;
  return quantity > 1 ? `${String(quantity)} x ${label}` : label;
}

function buildReceiptItems(
  context: CanvasRenderingContext2D,
  items: readonly Pick<CalculatorItem, 'label' | 'quantity'>[],
): ReceiptItem[] {
  setFont(context, 20, 700);
  const maxWidth = IMAGE_WIDTH - IMAGE_HORIZONTAL_PADDING * 2;
  const receiptItems = items.map((item) => ({
    lines: wrapText(context, formatReceiptItemLabel(item), maxWidth),
  }));

  return receiptItems.length > 0 ? receiptItems : [{ lines: ['Sin unidades seleccionadas'] }];
}

function getReceiptHeight(items: ReceiptItem[], hasReinforcements: boolean): number {
  const itemsHeight = items.reduce(
    (height, item, index) =>
      height + item.lines.length * ITEM_LINE_HEIGHT + (index === items.length - 1 ? 0 : ITEM_GAP),
    0,
  );
  const reinforcementHeight = hasReinforcements ? 152 : 0;
  return HEADER_HEIGHT + 48 + 34 + itemsHeight + 72 + 126 + reinforcementHeight + 48;
}

function drawReceiptItems(
  context: CanvasRenderingContext2D,
  y: number,
  items: ReceiptItem[],
): number {
  setFont(context, 20, 700);
  context.fillStyle = INK;

  for (const [index, item] of items.entries()) {
    for (const line of item.lines) {
      context.fillText(line, IMAGE_HORIZONTAL_PADDING, y);
      y += ITEM_LINE_HEIGHT;
    }
    if (index < items.length - 1) y += ITEM_GAP;
  }

  return y;
}

function drawInstallment(
  context: CanvasRenderingContext2D,
  y: number,
  label: string,
  description: string,
  amount: string,
  isPrimary: boolean,
): number {
  y = drawSectionLabel(context, y, label);
  setFont(context, 18, 600);
  context.fillStyle = MUTED_INK;
  context.fillText(description, IMAGE_HORIZONTAL_PADDING, y);
  setFont(context, isPrimary ? 56 : 36, 800);
  context.fillStyle = BRAND_BLUE;
  context.fillText(amount, IMAGE_HORIZONTAL_PADDING, y + (isPrimary ? 62 : 46));
  return y + (isPrimary ? 92 : 70);
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
  items: readonly Pick<CalculatorItem, 'label' | 'quantity'>[];
  plan: InstallmentPlan;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementPeriodicity: CuotaPeriodicity;
}

/** Genera un recibo de cuotas de TIMBO sin precios de unidades ni total final. */
export async function downloadInstallmentSummaryImage({
  items,
  plan,
  installmentPeriodicity,
  reinforcementPeriodicity,
}: InstallmentSummaryImageInput): Promise<void> {
  const brandLogo = await loadBrandLogo();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('El navegador no permite crear la imagen del cuotero.');
  }

  const hasReinforcements = plan.reinforcementCount > 0;
  const receiptItems = buildReceiptItems(context, items);
  const imageHeight = getReceiptHeight(receiptItems, hasReinforcements);
  canvas.width = IMAGE_WIDTH * IMAGE_SCALE;
  canvas.height = imageHeight * IMAGE_SCALE;

  context.scale(IMAGE_SCALE, IMAGE_SCALE);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, IMAGE_WIDTH, imageHeight);

  context.fillStyle = BRAND_BLUE;
  context.fillRect(0, 0, IMAGE_WIDTH, HEADER_HEIGHT);
  context.drawImage(brandLogo, IMAGE_HORIZONTAL_PADDING, 27, 168, 42);
  setFont(context, 20, 700);
  context.fillStyle = '#ffffff';
  context.textAlign = 'right';
  context.fillText('PLAN DE PAGO', IMAGE_WIDTH - IMAGE_HORIZONTAL_PADDING, 61);
  context.textAlign = 'left';

  let y = HEADER_HEIGHT + 48;
  y = drawSectionLabel(context, y, 'UNIDADES');
  y = drawReceiptItems(context, y, receiptItems);
  drawRule(context, y + 24);

  y = drawInstallment(
    context,
    y + 72,
    'CUOTA REGULAR',
    `${String(plan.regularInstallmentCount)} cuotas ${PERIODICITY_ADJECTIVE_PLURAL[installmentPeriodicity]}`,
    formatUsd(plan.regularInstallmentAmountUsd),
    true,
  );

  if (hasReinforcements) {
    drawRule(context, y + 12);
    y = drawInstallment(
      context,
      y + 48,
      'REFUERZOS',
      `${String(plan.reinforcementCount)} refuerzos ${PERIODICITY_ADJECTIVE_PLURAL[reinforcementPeriodicity]}`,
      formatUsd(plan.reinforcementAmountUsd),
      false,
    );
  }

  drawRule(context, y + 24);

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
