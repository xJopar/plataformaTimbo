import type { AdvisorMonthGoal } from './meta-company-mock-data';

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
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMonthLabel(periodo: string): string {
  const [year, month] = periodo.split('-');
  const monthName = SHORT_MONTH_NAMES[Number(month) - 1];
  return `${month}/${year} · ${monthName}`;
}

export function formatMoney(value: string): string {
  return MONEY_FORMATTER.format(Number(value));
}

interface MonthGoalRowProps {
  month: AdvisorMonthGoal;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (periodo: string, value: string) => void;
}

export function MonthGoalRow({
  month,
  canEdit,
  isSaving,
  onSave,
}: MonthGoalRowProps): React.JSX.Element {
  const label = formatMonthLabel(month.periodo);

  return (
    <form
      className="mc-month-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(month.periodo, String(new FormData(event.currentTarget).get('value')));
      }}
    >
      <span className="mc-month-label">{label}</span>
      {canEdit ? (
        <input
          name="value"
          defaultValue={month.meta ?? ''}
          inputMode="decimal"
          placeholder="Sin meta"
          aria-label={`Meta de ${label}`}
        />
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
