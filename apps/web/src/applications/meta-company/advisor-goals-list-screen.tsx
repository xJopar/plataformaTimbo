import type { Advisor } from './meta-company-types';
import { YearFilter } from './year-filter';

interface AdvisorGoalsListScreenProps {
  advisors: Advisor[];
  year: number;
  onYearChange: (year: number) => void;
  onSelectAdvisor: (advisorId: number) => void;
}

export function AdvisorGoalsListScreen({
  advisors,
  year,
  onYearChange,
  onSelectAdvisor,
}: AdvisorGoalsListScreenProps): React.JSX.Element {
  return (
    <section className="mc-advisor-goals" aria-labelledby="mc-advisor-goals-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-advisor-goals-title">Metas por asesor</h2>
          <p>Elegí un asesor para consultar y editar sus metas por marca.</p>
        </div>
        <YearFilter year={year} onChange={onYearChange} />
      </div>

      {advisors.length === 0 ? (
        <section className="mc-empty">
          <h2>No hay asesores activos</h2>
          <p>Creá un asesor desde "Gestionar asesores" para poder cargarle metas acá.</p>
        </section>
      ) : (
        <ul className="mc-advisor-list">
          {advisors.map((advisor) => (
            <li key={advisor.id} className="mc-advisor-list-item">
              <div>
                <h3>{advisor.displayName}</h3>
                <p>Metas por marca · {String(year)}</p>
              </div>
              <button
                type="button"
                className="mc-secondary-action"
                onClick={() => onSelectAdvisor(advisor.id)}
              >
                Ver metas
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
