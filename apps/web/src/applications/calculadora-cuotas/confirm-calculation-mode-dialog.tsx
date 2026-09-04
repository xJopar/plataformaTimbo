import { useEffect, useRef } from 'react';
import type { CalculationMode } from './installment-calculator';

interface ConfirmCalculationModeDialogProps {
  mode: CalculationMode | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

const MODE_LABELS: Record<CalculationMode, string> = {
  standard: 'Normal',
  'target-installment': 'Cuota objetivo',
};

export function ConfirmCalculationModeDialog({
  mode,
  onCancel,
  onConfirm,
}: ConfirmCalculationModeDialogProps): React.JSX.Element | null {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode === undefined) return;
    cancelButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onCancel]);

  if (mode === undefined) return null;

  return (
    <div className="cc-dialog-overlay" onClick={onCancel}>
      <div
        className="cc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cc-mode-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cc-mode-dialog-title">¿Cambiar a modalidad {MODE_LABELS[mode]}?</h2>
        <p>
          Se conservará la entrega inicial. Se restablecerán plazo, periodicidad, refuerzos y el
          importe de cuota.
        </p>
        <div className="cc-dialog-actions">
          <button type="button" className="text-button" ref={cancelButtonRef} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="cc-dialog-confirm" onClick={onConfirm}>
            Cambiar modalidad
          </button>
        </div>
      </div>
    </div>
  );
}
