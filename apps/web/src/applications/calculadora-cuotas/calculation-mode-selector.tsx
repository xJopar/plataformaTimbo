import type { CalculationMode } from './installment-calculator';

interface CalculationModeSelectorProps {
  selectedMode: CalculationMode | undefined;
  onSelect: (mode: CalculationMode) => void;
  onBack: (isPointerInitiated: boolean) => void;
  onContinue: (isPointerInitiated: boolean) => void;
}

export function CalculationModeSelector({
  selectedMode,
  onSelect,
  onBack,
  onContinue,
}: CalculationModeSelectorProps): React.JSX.Element {
  return (
    <section className="cc-mode-selection" aria-labelledby="cc-mode-selection-title">
      <h2 id="cc-mode-selection-title" className="cc-section-title">
        ¿Cómo querés calcular el plan?
      </h2>
      <div
        className="cc-calculation-mode-options"
        data-selected-mode={selectedMode ?? 'none'}
        role="group"
        aria-label="Modalidad de cálculo"
      >
        <div className="cc-calculation-mode-list" aria-hidden="true">
          <div className="cc-calculation-mode-copy cc-calculation-mode-copy--standard">
            <strong>Normal</strong>
            <span>Configurá plazo, periodicidad, refuerzos y entrega inicial.</span>
          </div>
          <div className="cc-calculation-mode-copy cc-calculation-mode-copy--target">
            <strong>Cuota objetivo</strong>
            <span>Partí del importe que el cliente desea pagar por cuota.</span>
          </div>
        </div>
        <div className="cc-calculation-mode-surface" aria-hidden="true">
          <div className="cc-calculation-mode-copy cc-calculation-mode-copy--standard">
            <strong>Normal</strong>
            <span>Configurá plazo, periodicidad, refuerzos y entrega inicial.</span>
          </div>
          <div className="cc-calculation-mode-copy cc-calculation-mode-copy--target">
            <strong>Cuota objetivo</strong>
            <span>Partí del importe que el cliente desea pagar por cuota.</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Normal"
          aria-pressed={selectedMode === 'standard'}
          className="cc-calculation-mode-option cc-calculation-mode-option--standard"
          data-selected={selectedMode === 'standard'}
          onClick={() => onSelect('standard')}
        />
        <button
          type="button"
          aria-label="Cuota objetivo"
          aria-pressed={selectedMode === 'target-installment'}
          className="cc-calculation-mode-option cc-calculation-mode-option--target"
          data-selected={selectedMode === 'target-installment'}
          onClick={() => onSelect('target-installment')}
        />
      </div>
      <footer className="cc-wizard-actions">
        <button
          type="button"
          className="cc-secondary-action"
          onClick={(event) => onBack(event.detail > 0)}
        >
          Volver a unidades
        </button>
        <button
          type="button"
          className="cc-apply-btn"
          disabled={selectedMode === undefined}
          onClick={(event) => onContinue(event.detail > 0)}
        >
          Continuar con condiciones
        </button>
      </footer>
    </section>
  );
}
