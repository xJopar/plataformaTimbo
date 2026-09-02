interface YearFilterProps {
  year: number;
  onChange: (year: number) => void;
}

const YEARS_BEFORE = 4;
const YEARS_AFTER = 1;

export function YearFilter({ year, onChange }: YearFilterProps): React.JSX.Element {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - YEARS_BEFORE;
  const maxYear = currentYear + YEARS_AFTER;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);

  return (
    <div className="mc-year-filter mc-year-filter--enter" role="group" aria-label="Filtrar por año">
      <button
        type="button"
        className="mc-year-step"
        disabled={year <= minYear}
        aria-label="Año anterior"
        onClick={() => onChange(year - 1)}
      >
        ‹
      </button>
      <select
        className="mc-year-select"
        value={year}
        aria-label="Año"
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {years.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="mc-year-step"
        disabled={year >= maxYear}
        aria-label="Año siguiente"
        onClick={() => onChange(year + 1)}
      >
        ›
      </button>
    </div>
  );
}
