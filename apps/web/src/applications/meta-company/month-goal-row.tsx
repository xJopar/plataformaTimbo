import { useState } from 'react';

const SHORT_MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const MONEY_FORMATTER = new Intl.NumberFormat('es-PY', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMonthLabel(period: string): string {
  const [year, month] = period.split('-');
  const monthName = SHORT_MONTH_NAMES[Number(month) - 1];
  return `${month}/${year} · ${monthName}`;
}

export function formatMoney(value: string): string {
  return MONEY_FORMATTER.format(Number(value));
}

export function parseMoneyInput(value: string): string | undefined {
  const trimmedValue = value.trim();
  if (trimmedValue === '') return undefined;
  const normalizedValue = trimmedValue.includes(',')
    ? trimmedValue.replaceAll('.', '').replace(',', '.')
    : trimmedValue;
  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue.toFixed(2) : undefined;
}

interface MonthGoalRowProps {
  month: { periodo: string; meta: string | null };
  canEdit: boolean;
  isSaving: boolean;
  onSave: (period: string, value: string) => void;
}

export function MonthGoalRow({
  month,
  canEdit,
  isSaving,
  onSave,
}: MonthGoalRowProps): React.JSX.Element {
  const label = formatMonthLabel(month.periodo);
  const [value, setValue] = useState(month.meta === null ? '' : formatMoney(month.meta));
  const [validationError, setValidationError] = useState<string>();

  return (
    <form
      className="mc-month-row"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedValue = parseMoneyInput(value);
        if (normalizedValue === undefined) {
          setValidationError('Ingresá una meta válida, sin valores negativos.');
          return;
        }
        setValidationError(undefined);
        onSave(month.periodo, normalizedValue);
      }}
    >
      <span className="mc-month-label">{label}</span>
      {canEdit ? (
        <div className="mc-month-input">
          <input
            name="value"
            value={value}
            inputMode="decimal"
            onBlur={() => {
              const normalizedValue = parseMoneyInput(value);
              if (normalizedValue !== undefined) setValue(formatMoney(normalizedValue));
            }}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0,00"
            aria-label={`Meta de ${label}`}
            aria-describedby={
              validationError === undefined ? undefined : `mc-month-error-${month.periodo}`
            }
            aria-invalid={validationError === undefined ? undefined : true}
          />
          {validationError === undefined ? null : (
            <span id={`mc-month-error-${month.periodo}`} role="alert">
              {validationError}
            </span>
          )}
        </div>
      ) : (
        <output className="mc-month-value">
          {month.meta === null ? 'Sin meta' : formatMoney(month.meta)}
        </output>
      )}
      {canEdit ? (
        <button className="mc-primary-action" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
      ) : null}
    </form>
  );
}
