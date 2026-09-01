import { useEffect, useMemo, useState } from 'react';
import type { ApplicationComponentProps } from '../application-component';
import { PlatformHeader } from '../../layout/platform-header';
import { PlatformSessionBar } from '../../layout/platform-session-bar';
import './meta-company-application.css';

type Goal = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['listMetaCompanyGoals']>
>[number];

export function MetaCompanyApplication(props: ApplicationComponentProps): React.JSX.Element {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [mode, setMode] = useState<'advisor' | 'brand'>('advisor');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string>();
  const [savingId, setSavingId] = useState<number>();
  useEffect(() => {
    void props.api.applications
      .listMetaCompanyGoals(`${period}-01`)
      .then(setGoals)
      .catch(() => setError('No pudimos cargar las metas. Intentá nuevamente.'));
  }, [period, props.api]);
  const groups = useMemo(() => {
    const grouped = new Map<string, Goal[]>();
    for (const goal of goals) {
      const key =
        mode === 'advisor'
          ? goal.salespersonCode === null
            ? 'Metas por marca'
            : `Asesor #${goal.salespersonCode}`
          : goal.brandName;
      grouped.set(key, [...(grouped.get(key) ?? []), goal]);
    }
    return [...grouped.entries()];
  }, [goals, mode]);
  const save = async (goal: Goal, value: string) => {
    setSavingId(goal.id);
    setError(undefined);
    try {
      await props.api.applications.updateMetaCompanyGoal(goal.id, value);
      setGoals((items) => items.map((item) => (item.id === goal.id ? { ...item, value } : item)));
    } catch {
      setError('No pudimos guardar la meta. Intentá nuevamente.');
    } finally {
      setSavingId(undefined);
    }
  };
  return (
    <main className="platform-shell meta-company-shell">
      <PlatformHeader
        applications={props.availableApplications}
        applicationName={props.application.name}
        applicationLaunchPath={props.application.launchPath}
        isLoggingOut={props.isLoggingOut}
        isPlatformAdministrator={props.session.isPlatformAdministrator}
        showAdministrationLink={false}
        variant="application"
        onNavigate={props.onNavigate}
        onLogout={props.onLogout}
      />
      <PlatformSessionBar session={props.session} />
      <section className="mc-page">
        <header className="mc-title">
          <h1>Metas comerciales</h1>
          <p>Actualizá los valores que Power BI utilizará en sus reportes.</p>
        </header>
        <div className="mc-toolbar">
          <label>
            Período
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
          </label>
          <div className="mc-switch" role="group" aria-label="Agrupar metas">
            <button
              className={mode === 'advisor' ? 'is-active' : ''}
              onClick={() => setMode('advisor')}
            >
              Por asesor
            </button>
            <button
              className={mode === 'brand' ? 'is-active' : ''}
              onClick={() => setMode('brand')}
            >
              Por marca
            </button>
          </div>
        </div>
        {error === undefined ? null : (
          <p className="mc-error" role="alert">
            {error}
          </p>
        )}
        <div className="mc-groups">
          {groups.map(([title, items]) => (
            <section className="mc-group" key={title}>
              <h2>{title}</h2>
              {items.map((goal) => (
                <form
                  className="mc-goal"
                  key={goal.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(goal, new FormData(event.currentTarget).get('value') as string);
                  }}
                >
                  <div>
                    <strong>{goal.brandName}</strong>
                    <span>
                      {goal.businessName} · Meta {goal.goalType}
                    </span>
                  </div>
                  <label>
                    Meta
                    <input
                      name="value"
                      defaultValue={goal.value}
                      inputMode="decimal"
                      aria-label={`Meta de ${goal.brandName}`}
                    />
                  </label>
                  <button disabled={savingId === goal.id}>
                    {savingId === goal.id ? 'Guardando…' : 'Guardar'}
                  </button>
                </form>
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
