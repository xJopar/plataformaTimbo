import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downloadInstallmentSummaryImage,
  formatReceiptItemLabel,
} from './installment-summary-image';

describe('formatReceiptItemLabel', () => {
  it('muestra la descripción de una única unidad sin prefijo', () => {
    expect(formatReceiptItemLabel({ label: 'BAIC X55', quantity: 1 })).toBe('BAIC X55');
  });

  it('antepone la cantidad cuando hay más de una unidad', () => {
    expect(formatReceiptItemLabel({ label: 'BAIC X55', quantity: 2 })).toBe('2 x BAIC X55');
  });

  it('conserva una etiqueta segura cuando la descripción está vacía', () => {
    expect(formatReceiptItemLabel({ label: '   ', quantity: 4 })).toBe(
      '4 x Unidad sin descripción',
    );
  });
});

describe('downloadInstallmentSummaryImage', () => {
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('incluye la entrega inicial como importe, sin su porcentaje', async () => {
    vi.useFakeTimers();
    const fillText = vi.fn<(text: string, x: number, y: number, maxWidth?: number) => void>();
    const context = {
      beginPath: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText,
      lineTo: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      moveTo: vi.fn(),
      scale: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      font: '',
      lineWidth: 0,
      strokeStyle: '',
      textAlign: 'left',
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      getContext: vi.fn(() => context),
      toBlob: (callback: BlobCallback) => {
        callback(new Blob());
      },
    } as unknown as HTMLCanvasElement;
    let loadListener: (() => void) | undefined;
    const logo = {
      addEventListener: (event: string, listener: () => void) => {
        if (event === 'load') loadListener = listener;
      },
      set src(_source: string) {
        loadListener?.();
      },
    } as unknown as HTMLImageElement;
    const downloadLink = {
      click: vi.fn(),
      remove: vi.fn(),
      download: '',
      href: '',
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') return canvas;
      if (tagName === 'img') return logo;
      if (tagName === 'a') return downloadLink;
      throw new Error(`Elemento inesperado: ${tagName}`);
    });
    vi.spyOn(document.body, 'append').mockImplementation(() => document.body);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:cuotero'),
      revokeObjectURL: vi.fn(),
    });

    await downloadInstallmentSummaryImage({
      items: [{ label: 'BAIC X55', quantity: 1 }],
      plan: {
        annualRatePercent: 9,
        downPaymentPercent: 20,
        downPaymentUsd: 2_500,
        financedPrincipalUsd: 10_000,
        interestTotalUsd: 900,
        reinforcementAmountUsd: 0,
        reinforcementCount: 0,
        regularInstallmentAmountUsd: 908.33,
        regularInstallmentCount: 12,
        saldoAFinanciarUsd: 10_900,
        totalPagarUsd: 13_400,
        totalPriceUsd: 12_500,
      },
      installmentPeriodicity: 'mensual',
      reinforcementPeriodicity: 'semestral',
    });
    vi.runAllTimers();

    const renderedText = fillText.mock.calls.map(([text]) => text);
    expect(renderedText).toContain('ENTREGA INICIAL');
    expect(renderedText).toContain('2.500 USD');
    expect(renderedText).not.toContain('20%');
  });
});
