import { useCallback, useEffect, useState } from 'react';
import { ApiHttpError } from '../../api/system';
import {
  reportBrowserOperationFailed,
  type BrowserOperationFailureContext,
} from '../../browser-diagnostics';
import { PlatformHeader } from '../../layout/platform-header';
import { PlatformSessionBar } from '../../layout/platform-session-bar';
import type { ApplicationComponentProps } from '../application-component';
import './seguimiento-5s-application.css';

type Api = ApplicationComponentProps['api'];
type Capabilities = Awaited<ReturnType<Api['applications']['getSeguimiento5sCapabilities']>>;
type Indicator = Awaited<ReturnType<Api['applications']['listSeguimiento5sIndicators']>>[number];
type Participant = Awaited<
  ReturnType<Api['applications']['listSeguimiento5sParticipants']>
>[number];
type DailyEntries = Awaited<ReturnType<Api['applications']['getSeguimiento5sDailyEntries']>>;
type DashboardSummary = Awaited<
  ReturnType<Api['applications']['getSeguimiento5sDashboardSummary']>
>;
type EntryValue = DailyEntries['people'][number]['indicatorValues'][number]['value'];
type NonNullEntryValue = NonNullable<EntryValue>;
type RoleKey = NonNullable<Participant['roleKey']>;
type Tab = 'dashboard' | 'historial' | 'indicadores' | 'participantes';

const NO_CAPABILITIES: Capabilities = {
  canManageIndicators: false,
  canManageEntries: false,
  canManageParticipants: false,
};

export function Seguimiento5sApplication(props: ApplicationComponentProps): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [capabilities, setCapabilities] = useState<Capabilities>(NO_CAPABILITIES);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadWorkspace = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [loadedCapabilities, loadedIndicators] = await Promise.all([
        props.api.applications.getSeguimiento5sCapabilities(),
        props.api.applications.listSeguimiento5sIndicators(false),
      ]);
      setCapabilities(loadedCapabilities);
      setIndicators(loadedIndicators);
    } catch (loadError: unknown) {
      reportFailure(loadError, {
        operation: 'seguimiento-5s.load-data',
        method: 'GET',
        route: '/api/applications/seguimiento-5s/capabilities',
        provider: 'api',
      });
      setError('No pudimos cargar Seguimiento 5S. Intentá nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }, [props.api]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  return (
    <main className="platform-shell seguimiento-5s-shell">
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

      <section className="s5-page">
        <header className="s5-title">
          <div>
            <h1>Seguimiento 5S</h1>
            <p>Participación, orden y limpieza del equipo, día a día.</p>
          </div>
        </header>

        <nav className="s5-tabs" aria-label="Secciones de Seguimiento 5S">
          <button
            type="button"
            className={tab === 'dashboard' ? 'is-active' : ''}
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={tab === 'historial' ? 'is-active' : ''}
            onClick={() => setTab('historial')}
          >
            Historial
          </button>
          <button
            type="button"
            className={tab === 'indicadores' ? 'is-active' : ''}
            onClick={() => setTab('indicadores')}
          >
            Indicadores
          </button>
          {capabilities.canManageParticipants ? (
            <button
              type="button"
              className={tab === 'participantes' ? 'is-active' : ''}
              onClick={() => setTab('participantes')}
            >
              Participantes
            </button>
          ) : null}
        </nav>

        {error === undefined ? null : (
          <div className="s5-state s5-state-error">
            <p>{error}</p>
            <button
              type="button"
              className="s5-secondary-action"
              onClick={() => void loadWorkspace()}
            >
              Reintentar
            </button>
          </div>
        )}

        {isLoading ? <p className="s5-state">Cargando Seguimiento 5S…</p> : null}

        {!isLoading && error === undefined ? (
          <>
            {tab === 'dashboard' ? <DashboardTab api={props.api} /> : null}
            {tab === 'historial' ? (
              <HistorialTab
                api={props.api}
                indicators={indicators}
                canManageEntries={capabilities.canManageEntries}
              />
            ) : null}
            {tab === 'indicadores' ? (
              <IndicadoresTab
                api={props.api}
                canManage={capabilities.canManageIndicators}
                onChanged={loadWorkspace}
              />
            ) : null}
            {tab === 'participantes' && capabilities.canManageParticipants ? (
              <ParticipantesTab api={props.api} />
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

function DashboardTab({ api }: { api: Api }): React.JSX.Element {
  const [rangeDays, setRangeDays] = useState(14);
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; summary: DashboardSummary } | { status: 'error' }
  >({ status: 'loading' });

  const load = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - (rangeDays - 1) * 86_400_000).toISOString().slice(0, 10);
      const summary = await api.applications.getSeguimiento5sDashboardSummary(from, to);
      setState({ status: 'ready', summary });
    } catch (loadError: unknown) {
      reportFailure(loadError, {
        operation: 'seguimiento-5s.load-data',
        method: 'GET',
        route: '/api/applications/seguimiento-5s/dashboard/summary',
        provider: 'api',
      });
      setState({ status: 'error' });
    }
  }, [api, rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="s5-tab" aria-labelledby="s5-dashboard-title">
      <div className="s5-tab-heading">
        <h2 id="s5-dashboard-title">Cumplimiento ponderado</h2>
        <div className="s5-range-switch" role="group" aria-label="Rango del gráfico">
          {[14, 30, 60].map((days) => (
            <button
              key={days}
              type="button"
              className={rangeDays === days ? 'is-active' : ''}
              onClick={() => setRangeDays(days)}
            >
              {days} días
            </button>
          ))}
        </div>
      </div>

      {state.status === 'loading' ? <p className="s5-state">Cargando dashboard…</p> : null}
      {state.status === 'error' ? (
        <div className="s5-state s5-state-error">
          <p>No pudimos cargar el dashboard.</p>
          <button type="button" className="s5-secondary-action" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <div className="s5-kpi-grid">
            <KpiTile
              label="Último día cargado"
              value={
                state.summary.lastLoadedDate === null
                  ? 'Sin datos'
                  : formatDisplayDate(state.summary.lastLoadedDate)
              }
            />
            <KpiTile
              label="Cumplimiento del día"
              value={formatPercentage(state.summary.lastLoadedCompliance)}
            />
            <KpiTile label="Controles realizados" value={String(state.summary.controlsPerformed)} />
            <KpiTile label="Marcados N/A" value={String(state.summary.markedNotApplicable)} />
          </div>
          <section className="s5-chart-card">
            <h3>Cumplimiento diario ponderado — {rangeDays} días</h3>
            <WeightedComplianceChart points={state.summary.dailySeries} />
          </section>
        </>
      ) : null}
    </section>
  );
}

function KpiTile({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="s5-kpi-tile">
      <span className="s5-kpi-label">{label}</span>
      <span className="s5-kpi-value">{value}</span>
    </div>
  );
}

function WeightedComplianceChart({
  points,
}: {
  points: DashboardSummary['dailySeries'];
}): React.JSX.Element {
  if (points.length === 0) {
    return <p className="s5-chart-empty">Todavía no hay días registrados en este rango.</p>;
  }

  const width = 720;
  const height = 240;
  const left = 44;
  const right = 12;
  const top = 16;
  const bottom = 32;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => ({
    entryDate: point.entryDate,
    x: left + stepX * index,
    y: point.compliance === null ? null : top + plotHeight * (1 - point.compliance),
  }));

  const linePath = coordinates
    .filter((point): point is { entryDate: string; x: number; y: number } => point.y !== null)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');

  const lastIndex = points.length - 1;
  const middleIndex = Math.floor(lastIndex / 2);
  const labeledIndexes = [...new Set([0, middleIndex, lastIndex])];

  return (
    <svg
      className="s5-chart"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      role="img"
      aria-label="Cumplimiento diario ponderado, en porcentaje"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
        const y = top + plotHeight * (1 - fraction);
        return (
          <g key={fraction}>
            <line x1={left} x2={width - right} y1={y} y2={y} className="s5-chart-gridline" />
            <text
              x={left - 8}
              y={y}
              className="s5-chart-axis-label"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {Math.round(fraction * 100)}%
            </text>
          </g>
        );
      })}
      {linePath === '' ? null : <path d={linePath} className="s5-chart-line" fill="none" />}
      {coordinates.map((point) =>
        point.y === null ? null : (
          <circle
            key={point.entryDate}
            cx={point.x}
            cy={point.y}
            r={3.5}
            className="s5-chart-point"
          />
        ),
      )}
      {labeledIndexes.map((index) => {
        const point = coordinates[index];
        if (point === undefined) return null;
        return (
          <text
            key={index}
            x={point.x}
            y={height - 8}
            className="s5-chart-axis-label"
            textAnchor="middle"
          >
            {formatShortDate(point.entryDate)}
          </text>
        );
      })}
    </svg>
  );
}

function cellKey(userId: string, indicatorId: string): string {
  return `${userId}:${indicatorId}`;
}

function HistorialTab({
  api,
  indicators,
  canManageEntries,
}: {
  api: Api;
  indicators: Indicator[];
  canManageEntries: boolean;
}): React.JSX.Element {
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; entries: DailyEntries } | { status: 'error' }
  >({ status: 'loading' });
  const [draft, setDraft] = useState<Map<string, EntryValue>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    setError(undefined);
    setNotice(undefined);
    try {
      const entries = await api.applications.getSeguimiento5sDailyEntries(entryDate);
      setState({ status: 'ready', entries });
      setDraft(
        new Map(
          entries.people.flatMap((person) =>
            person.indicatorValues.map(
              (indicatorValue) =>
                [cellKey(person.userId, indicatorValue.indicatorId), indicatorValue.value] as const,
            ),
          ),
        ),
      );
    } catch (loadError: unknown) {
      reportFailure(loadError, {
        operation: 'seguimiento-5s.load-data',
        method: 'GET',
        route: '/api/applications/seguimiento-5s/entries',
        provider: 'api',
      });
      setState({ status: 'error' });
    }
  }, [api, entryDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const setCell = (userId: string, indicatorId: string, value: NonNullEntryValue): void => {
    setDraft((current) => new Map(current).set(cellKey(userId, indicatorId), value));
  };

  const save = async (): Promise<void> => {
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const entries = [...draft.entries()]
        .filter((entry): entry is [string, NonNullEntryValue] => entry[1] !== null)
        .map(([key, value]) => {
          const [userId, indicatorId] = key.split(':');
          return { userId: userId ?? '', indicatorId: indicatorId ?? '', value };
        });
      const updated = await api.applications.saveSeguimiento5sDailyEntries({ entryDate, entries });
      setState({ status: 'ready', entries: updated });
      setNotice('Checklist guardado.');
    } catch (saveError: unknown) {
      reportFailure(saveError, {
        operation: 'seguimiento-5s.save-entries',
        method: 'PUT',
        route: '/api/applications/seguimiento-5s/entries',
        provider: 'api',
      });
      setError('No pudimos guardar el checklist. Intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="s5-tab" aria-labelledby="s5-historial-title">
      <div className="s5-tab-heading">
        <h2 id="s5-historial-title">Historial diario</h2>
        <label className="s5-date-field">
          Fecha
          <input
            type="date"
            value={entryDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setEntryDate(event.target.value)}
          />
        </label>
      </div>

      {error === undefined ? null : (
        <p className="s5-error" role="alert">
          {error}
        </p>
      )}
      {notice === undefined ? null : (
        <p className="s5-notice" role="status">
          {notice}
        </p>
      )}

      {state.status === 'loading' ? <p className="s5-state">Cargando checklist…</p> : null}
      {state.status === 'error' ? (
        <div className="s5-state s5-state-error">
          <p>No pudimos cargar el checklist de esa fecha.</p>
          <button type="button" className="s5-secondary-action" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {state.status === 'ready' && indicators.length === 0 ? (
        <p className="s5-state">Todavía no hay indicadores activos para registrar.</p>
      ) : null}

      {state.status === 'ready' && indicators.length > 0 ? (
        <>
          <div className="s5-table-wrap">
            <table className="s5-table">
              <thead>
                <tr>
                  <th>Persona</th>
                  {indicators.map((indicator) => (
                    <th key={indicator.id}>{indicator.name}</th>
                  ))}
                  <th>Puntos</th>
                  <th>Evaluados</th>
                  <th>N/A</th>
                  <th>Pendientes</th>
                  <th>Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {state.entries.people.length === 0 ? (
                  <tr>
                    <td colSpan={indicators.length + 5}>
                      Todavía no hay participantes asignados a Seguimiento 5S.
                    </td>
                  </tr>
                ) : null}
                {state.entries.people.map((person) => (
                  <tr key={person.userId}>
                    <td>{person.displayName}</td>
                    {person.indicatorValues.map((indicatorValue) => (
                      <td key={indicatorValue.indicatorId}>
                        <FiveSValueControl
                          value={
                            draft.get(cellKey(person.userId, indicatorValue.indicatorId)) ?? null
                          }
                          readOnly={!canManageEntries}
                          onChange={(value) =>
                            setCell(person.userId, indicatorValue.indicatorId, value)
                          }
                        />
                      </td>
                    ))}
                    <td>{person.points}</td>
                    <td>{person.evaluated}</td>
                    <td>{person.notApplicable}</td>
                    <td>{person.pending}</td>
                    <td>{formatPercentage(person.compliance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canManageEntries && state.entries.people.length > 0 ? (
            <div className="s5-table-actions">
              <button
                type="button"
                className="s5-primary-action"
                disabled={isSaving}
                onClick={() => void save()}
              >
                {isSaving ? 'Guardando…' : 'Guardar checklist'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function FiveSValueControl({
  value,
  readOnly,
  onChange,
}: {
  value: EntryValue;
  readOnly: boolean;
  onChange: (value: NonNullEntryValue) => void;
}): React.JSX.Element {
  if (readOnly) {
    return (
      <span className={`s5-value-badge s5-value-badge--${(value ?? 'PENDING').toLowerCase()}`}>
        {labelForEntryValue(value)}
      </span>
    );
  }

  return (
    <div className="s5-value-switch" role="group" aria-label="Valor del indicador">
      <button
        type="button"
        className={value === 'MET' ? 'is-active is-met' : ''}
        onClick={() => onChange('MET')}
      >
        Cumple
      </button>
      <button
        type="button"
        className={value === 'NOT_MET' ? 'is-active is-not-met' : ''}
        onClick={() => onChange('NOT_MET')}
      >
        No cumple
      </button>
      <button
        type="button"
        className={value === 'NOT_APPLICABLE' ? 'is-active is-na' : ''}
        onClick={() => onChange('NOT_APPLICABLE')}
      >
        N/A
      </button>
    </div>
  );
}

function labelForEntryValue(value: EntryValue): string {
  switch (value) {
    case 'MET':
      return 'Cumple';
    case 'NOT_MET':
      return 'No cumple';
    case 'NOT_APPLICABLE':
      return 'N/A';
    default:
      return 'Pendiente';
  }
}

function IndicadoresTab({
  api,
  canManage,
  onChanged,
}: {
  api: Api;
  canManage: boolean;
  onChanged: () => Promise<void>;
}): React.JSX.Element {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; items: Indicator[] } | { status: 'error' }
  >({ status: 'loading' });
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    try {
      const items = await api.applications.listSeguimiento5sIndicators(canManage);
      setState({ status: 'ready', items });
    } catch (loadError: unknown) {
      reportFailure(loadError, {
        operation: 'seguimiento-5s.load-data',
        method: 'GET',
        route: '/api/applications/seguimiento-5s/indicators',
        provider: 'api',
      });
      setState({ status: 'error' });
    }
  }, [api, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (form: HTMLFormElement): Promise<void> => {
    const values = new FormData(form);
    setBusyId('creating');
    setError(undefined);
    try {
      await api.applications.createSeguimiento5sIndicator({
        key: String(values.get('key') ?? ''),
        name: String(values.get('name') ?? ''),
        controlledSince: String(values.get('controlledSince') ?? ''),
      });
      await Promise.all([load(), onChanged()]);
      form.reset();
      setIsCreating(false);
    } catch (creationError: unknown) {
      reportFailure(creationError, {
        operation: 'seguimiento-5s.manage-indicators',
        method: 'POST',
        route: '/api/applications/seguimiento-5s/indicators',
        provider: 'api',
      });
      setError('No pudimos crear el indicador. Verificá los datos e intentá nuevamente.');
    } finally {
      setBusyId(undefined);
    }
  };

  const toggleActive = async (indicator: Indicator): Promise<void> => {
    setBusyId(indicator.id);
    setError(undefined);
    try {
      await api.applications.setSeguimiento5sIndicatorActive(
        indicator.id,
        indicator.status !== 'ACTIVE',
      );
      await Promise.all([load(), onChanged()]);
    } catch (toggleError: unknown) {
      reportFailure(toggleError, {
        operation: 'seguimiento-5s.manage-indicators',
        method: 'POST',
        route: '/api/applications/seguimiento-5s/indicators/:id',
        provider: 'api',
      });
      setError('No pudimos cambiar el estado del indicador.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <section className="s5-tab" aria-labelledby="s5-indicadores-title">
      <div className="s5-tab-heading">
        <h2 id="s5-indicadores-title">Indicadores</h2>
        {canManage ? (
          <button
            type="button"
            className="s5-primary-action"
            onClick={() => setIsCreating((visible) => !visible)}
          >
            {isCreating ? 'Cancelar' : 'Nuevo indicador'}
          </button>
        ) : null}
      </div>

      {error === undefined ? null : (
        <p className="s5-error" role="alert">
          {error}
        </p>
      )}

      {isCreating ? (
        <form
          className="s5-form"
          onSubmit={(event) => {
            event.preventDefault();
            void create(event.currentTarget);
          }}
        >
          <label>
            Clave
            <input
              name="key"
              required
              placeholder="orden-de-cables"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
          </label>
          <label>
            Nombre
            <input name="name" required placeholder="Orden de cables" />
          </label>
          <label>
            Controlado desde
            <input name="controlledSince" type="date" required />
          </label>
          <button className="s5-primary-action" disabled={busyId === 'creating'}>
            {busyId === 'creating' ? 'Creando…' : 'Crear indicador'}
          </button>
        </form>
      ) : null}

      {state.status === 'loading' ? <p className="s5-state">Cargando indicadores…</p> : null}
      {state.status === 'error' ? (
        <div className="s5-state s5-state-error">
          <p>No pudimos cargar los indicadores.</p>
          <button type="button" className="s5-secondary-action" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <ul className="s5-indicator-list">
          {state.items.map((indicator) => (
            <li key={indicator.id}>
              <div>
                <strong>{indicator.name}</strong>
                <span>
                  Controlado desde {formatDisplayDate(indicator.controlledSince)} ·{' '}
                  {indicator.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="s5-text-action"
                  disabled={busyId === indicator.id}
                  onClick={() => void toggleActive(indicator)}
                >
                  {indicator.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ParticipantesTab({ api }: { api: Api }): React.JSX.Element {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; items: Participant[] } | { status: 'error' }
  >({ status: 'loading' });
  const [busyUserId, setBusyUserId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    try {
      const items = await api.applications.listSeguimiento5sParticipants();
      setState({ status: 'ready', items });
    } catch (loadError: unknown) {
      reportFailure(loadError, {
        operation: 'seguimiento-5s.load-data',
        method: 'GET',
        route: '/api/applications/seguimiento-5s/participants',
        provider: 'api',
      });
      setState({ status: 'error' });
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const setRole = async (userId: string, roleKey: RoleKey): Promise<void> => {
    setBusyUserId(userId);
    setError(undefined);
    try {
      await api.applications.setSeguimiento5sParticipantRole(userId, roleKey);
      await load();
    } catch (roleError: unknown) {
      reportFailure(roleError, {
        operation: 'seguimiento-5s.manage-participants',
        method: 'POST',
        route: '/api/applications/seguimiento-5s/participants/:userId/role',
        provider: 'api',
      });
      setError('No pudimos actualizar el rol.');
    } finally {
      setBusyUserId(undefined);
    }
  };

  return (
    <section className="s5-tab" aria-labelledby="s5-participantes-title">
      <h2 id="s5-participantes-title">Participantes</h2>
      <p className="s5-tab-description">
        Empleados asignados a Seguimiento 5S. Asignales el rol de líder o miembro.
      </p>

      {error === undefined ? null : (
        <p className="s5-error" role="alert">
          {error}
        </p>
      )}

      {state.status === 'loading' ? <p className="s5-state">Cargando participantes…</p> : null}
      {state.status === 'error' ? (
        <div className="s5-state s5-state-error">
          <p>No pudimos cargar los participantes.</p>
          <button type="button" className="s5-secondary-action" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      ) : null}

      {state.status === 'ready' && state.items.length === 0 ? (
        <p className="s5-state">
          Todavía no hay empleados asignados a Seguimiento 5S desde Administración.
        </p>
      ) : null}

      {state.status === 'ready' && state.items.length > 0 ? (
        <ul className="s5-indicator-list">
          {state.items.map((participant) => (
            <li key={participant.userId}>
              <div>
                <strong>{participant.displayName}</strong>
                <span>{participant.corporateEmail}</span>
              </div>
              <div
                className="s5-value-switch"
                role="group"
                aria-label={`Rol de ${participant.displayName}`}
              >
                <button
                  type="button"
                  className={participant.roleKey === 'lider-5s' ? 'is-active' : ''}
                  disabled={busyUserId === participant.userId}
                  onClick={() => void setRole(participant.userId, 'lider-5s')}
                >
                  Líder
                </button>
                <button
                  type="button"
                  className={participant.roleKey === 'miembro-5s' ? 'is-active' : ''}
                  disabled={busyUserId === participant.userId}
                  onClick={() => void setRole(participant.userId, 'miembro-5s')}
                >
                  Miembro
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatPercentage(value: number | null): string {
  return value === null ? '—' : `${String(Math.round(value * 100))}%`;
}

function formatDisplayDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T00:00:00.000Z`),
  );
}

function formatShortDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

function reportFailure(error: unknown, context: BrowserOperationFailureContext): void {
  reportBrowserOperationFailed(error, {
    ...context,
    ...(error instanceof ApiHttpError
      ? {
          status: error.status,
          ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
        }
      : {}),
  });
}
