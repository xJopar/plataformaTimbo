import { useEffect, useRef } from 'react';
import type { CalculatorItem } from './installment-calculator';

interface ConfirmRemoveDialogProps {
  item: CalculatorItem | undefined;
  onCancel: () => void;
  onConfirm: (itemId: string) => void;
}

export function ConfirmRemoveDialog({
  item,
  onCancel,
  onConfirm,
}: ConfirmRemoveDialogProps): React.JSX.Element | null {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (item === undefined) return;
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onCancel]);

  if (item === undefined) return null;

  return (
    <div className="cc-dialog-overlay" onClick={onCancel}>
      <div
        className="cc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cc-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="cc-dialog-title">¿Quitar esta unidad del cálculo?</h2>
        <p>
          Vas a quitar {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'} de{' '}
          <strong>{item.label}</strong> del cálculo. Esta acción no se puede deshacer.
        </p>
        <div className="cc-dialog-actions">
          <button type="button" className="text-button" ref={cancelButtonRef} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="cc-dialog-confirm" onClick={() => onConfirm(item.id)}>
            Quitar unidades
          </button>
        </div>
      </div>
    </div>
  );
}
