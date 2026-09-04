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
      <div className="cc-calculation-mode-options" role="group" aria-label="Modalidad de cálculo">
        <button
          type="button"
          aria-pressed={selectedMode === 'standard'}
          className={
            selectedMode === 'standard'
              ? 'cc-calculation-mode-option cc-calculation-mode-option--selected'
              : 'cc-calculation-mode-option'
          }
          onClick={() => onSelect('standard')}
        >
          <strong>Normal</strong>
          <span>Configurá plazo, periodicidad, refuerzos y entrega inicial.</span>
        </button>
        <button
          type="button"
          aria-pressed={selectedMode === 'target-installment'}
          className={
            selectedMode === 'target-installment'
              ? 'cc-calculation-mode-option cc-calculation-mode-option--selected'
              : 'cc-calculation-mode-option'
          }
          onClick={() => onSelect('target-installment')}
        >
          <strong>Cuota objetivo</strong>
          <span>Partí del importe que el cliente desea pagar por cuota.</span>
        </button>
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
