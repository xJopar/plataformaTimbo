import { useEffect, useMemo, useState } from 'react';
import { ApiHttpError } from '../../api/system';
import {
  reportBrowserOperationFailed,
  type BrowserOperationFailureContext,
} from '../../browser-diagnostics';
import { PlatformHeader } from '../../layout/platform-header';
import { PlatformSessionBar } from '../../layout/platform-session-bar';
import type { ApplicationComponentProps } from '../application-component';
import './meta-company-application.css';

type Goal = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['listMetaCompanyGoals']>
>[number];
type Catalogs = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['listMetaCompanyCatalogs']>
>;
type CatalogItem = Catalogs['brands'][number];
type Capabilities = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['getMetaCompanyCapabilities']>
>;
type CatalogKind = 'brand' | 'business';

const EMPTY_CATALOGS: Catalogs = { brands: [], businesses: [] };
const NO_CAPABILITIES: Capabilities = { canManageCatalogs: false, canManageGoals: false };

export function MetaCompanyApplication(props: ApplicationComponentProps): React.JSX.Element {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [mode, setMode] = useState<'advisor' | 'brand'>('advisor');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [allCatalogs, setAllCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [capabilities, setCapabilities] = useState<Capabilities>(NO_CAPABILITIES);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number>();
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);
  const [newGoalType, setNewGoalType] = useState<'Marca' | 'Vendedor'>('Marca');
  const [isManagingCatalogs, setIsManagingCatalogs] = useState(false);
  const [catalogAction, setCatalogAction] = useState<string>();

  const loadWorkspace = async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [loadedGoals, loadedCatalogs, loadedCapabilities] = await Promise.all([
        props.api.applications.listMetaCompanyGoals(`${period}-01`),
        props.api.applications.listMetaCompanyCatalogs(),
        props.api.applications.getMetaCompanyCapabilities(),
      ]);
      setGoals(loadedGoals);
      setCatalogs(loadedCatalogs);
      setCapabilities(loadedCapabilities);
      if (loadedCapabilities.canManageCatalogs) {
        setAllCatalogs(await props.api.applications.listAllMetaCompanyCatalogs());
      } else {
        setAllCatalogs(EMPTY_CATALOGS);
      }
    } catch (loadError: unknown) {
      reportFailure(loadError, {
        operation: 'meta-company.load-data',
        method: 'GET',
        route: '/api/applications/meta-company',
        provider: 'api',
      });
      setError('No pudimos cargar las metas y los catálogos. Intentá nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
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

  const saveGoal = async (goal: Goal, value: string): Promise<void> => {
    setSavingId(goal.id);
    setError(undefined);
    setNotice(undefined);
    try {
      const updatedGoal = await props.api.applications.updateMetaCompanyGoal(goal.id, value);
      setGoals((items) => items.map((item) => (item.id === goal.id ? updatedGoal : item)));
      setNotice('Meta actualizada.');
    } catch (saveError: unknown) {
      reportFailure(saveError, {
        operation: 'meta-company.update-goal',
        method: 'PATCH',
        route: '/api/applications/meta-company/goals/:id',
        provider: 'api',
      });
      setError('No pudimos guardar la meta. Revisá el valor e intentá nuevamente.');
    } finally {
      setSavingId(undefined);
    }
  };

  const createGoal = async (form: HTMLFormElement): Promise<void> => {
    const values = new FormData(form);
    const goalType = String(values.get('goalType')) as 'Marca' | 'Vendedor';
    const salespersonCodeText = String(values.get('salespersonCode') ?? '').trim();
    const salespersonCode = salespersonCodeText === '' ? undefined : Number(salespersonCodeText);
    setCatalogAction('goal');
    setError(undefined);
    setNotice(undefined);
    try {
      const createdGoal = await props.api.applications.createMetaCompanyGoal({
        period: `${period}-01`,
        businessId: Number(values.get('businessId')),
        brandId: Number(values.get('brandId')),
        goalType,
        value: String(values.get('value')),
        ...(goalType === 'Vendedor' && salespersonCode !== undefined ? { salespersonCode } : {}),
      });
      setGoals((items) => [...items, createdGoal]);
      setIsCreatingGoal(false);
      setNotice('Meta creada.');
    } catch (creationError: unknown) {
      reportFailure(creationError, {
        operation: 'meta-company.create-goal',
        method: 'POST',
        route: '/api/applications/meta-company/goals',
        provider: 'api',
      });
      setError('No pudimos crear la meta. Verificá los datos e intentá nuevamente.');
    } finally {
      setCatalogAction(undefined);
    }
  };

  const createCatalogItem = async (kind: CatalogKind, form: HTMLFormElement): Promise<void> => {
    const name = String(new FormData(form).get('name') ?? '');
    setCatalogAction(`${kind}-create`);
    setError(undefined);
    setNotice(undefined);
    try {
      if (kind === 'brand') {
        await props.api.applications.createMetaCompanyBrand({ name });
      } else {
        await props.api.applications.createMetaCompanyBusiness({ name });
      }
      await loadWorkspace();
      form.reset();
      setNotice(kind === 'brand' ? 'Marca creada.' : 'Negocio creado.');
    } catch (creationError: unknown) {
      reportFailure(creationError, {
        operation: 'meta-company.create-catalog',
        method: 'POST',
        route:
          kind === 'brand'
            ? '/api/applications/meta-company/brands'
            : '/api/applications/meta-company/businesses',
        provider: 'api',
      });
      setError(kind === 'brand' ? 'No pudimos crear la marca.' : 'No pudimos crear el negocio.');
    } finally {
      setCatalogAction(undefined);
    }
  };

  const setCatalogItemActive = async (kind: CatalogKind, item: CatalogItem): Promise<void> => {
    setCatalogAction(`${kind}-${item.id}`);
    setError(undefined);
    setNotice(undefined);
    try {
      if (kind === 'brand') {
        await props.api.applications.setMetaCompanyBrandActive(item.id, !item.active);
      } else {
        await props.api.applications.setMetaCompanyBusinessActive(item.id, !item.active);
      }
      await loadWorkspace();
      setNotice(item.active ? `${item.name} fue desactivado.` : `${item.name} fue reactivado.`);
    } catch (statusError: unknown) {
      reportFailure(statusError, {
        operation: 'meta-company.update-catalog',
        method: 'PATCH',
        route:
          kind === 'brand'
            ? '/api/applications/meta-company/brands/:id/active'
            : '/api/applications/meta-company/businesses/:id/active',
        provider: 'api',
      });
      setError('No pudimos actualizar el estado del catálogo. Intentá nuevamente.');
    } finally {
      setCatalogAction(undefined);
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
          <div>
            <h1>Metas comerciales</h1>
            <p>Actualizá los valores que Power BI utilizará en sus reportes.</p>
          </div>
          <div className="mc-title-actions">
            {capabilities.canManageGoals ? (
              <button
                type="button"
                className="mc-primary-action"
                onClick={() => setIsCreatingGoal(true)}
              >
                Nueva meta
              </button>
            ) : null}
            {capabilities.canManageCatalogs ? (
              <button
                type="button"
                className="mc-secondary-action"
                aria-expanded={isManagingCatalogs}
                onClick={() => setIsManagingCatalogs((visible) => !visible)}
              >
                Gestionar marcas y negocios
              </button>
            ) : null}
          </div>
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
              type="button"
              className={mode === 'advisor' ? 'is-active' : ''}
              onClick={() => setMode('advisor')}
            >
              Por asesor
            </button>
            <button
              type="button"
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
        {notice === undefined ? null : (
          <p className="mc-notice" role="status">
            {notice}
          </p>
        )}

        {isCreatingGoal ? (
          <section className="mc-workbench" aria-labelledby="mc-create-goal-title">
            <div className="mc-workbench-heading">
              <div>
                <h2 id="mc-create-goal-title">Registrar meta para {formatPeriod(period)}</h2>
                <p>
                  Elegí el negocio y la marca. Para una meta por vendedor, indicá su código SAP.
                </p>
              </div>
              <button
                type="button"
                className="mc-text-action"
                onClick={() => setIsCreatingGoal(false)}
              >
                Cancelar
              </button>
            </div>
            <form
              className="mc-create-goal-form"
              onSubmit={(event) => {
                event.preventDefault();
                void createGoal(event.currentTarget);
              }}
            >
              <label>
                Tipo de meta
                <select
                  name="goalType"
                  value={newGoalType}
                  onChange={(event) => setNewGoalType(event.target.value as 'Marca' | 'Vendedor')}
                >
                  <option value="Marca">Por marca</option>
                  <option value="Vendedor">Por vendedor</option>
                </select>
              </label>
              <label>
                Negocio
                <select name="businessId" required defaultValue="">
                  <option value="" disabled>
                    Seleccioná un negocio
                  </option>
                  {catalogs.businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Marca
                <select name="brandId" required defaultValue="">
                  <option value="" disabled>
                    Seleccioná una marca
                  </option>
                  {catalogs.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Código de asesor{' '}
                <span>
                  {newGoalType === 'Vendedor'
                    ? 'Obligatorio para meta por vendedor'
                    : 'No aplica a una meta por marca'}
                </span>
                <input
                  name="salespersonCode"
                  inputMode="numeric"
                  type="number"
                  min="1"
                  disabled={newGoalType === 'Marca'}
                  required={newGoalType === 'Vendedor'}
                />
              </label>
              <label>
                Valor de meta
                <input name="value" inputMode="decimal" required placeholder="0,00" />
              </label>
              <button className="mc-primary-action" disabled={catalogAction === 'goal'}>
                {catalogAction === 'goal' ? 'Creando…' : 'Crear meta'}
              </button>
            </form>
          </section>
        ) : null}

        {isManagingCatalogs ? (
          <section className="mc-workbench" aria-labelledby="mc-catalog-title">
            <div className="mc-workbench-heading">
              <div>
                <h2 id="mc-catalog-title">Marcas y negocios</h2>
                <p>
                  Los registros inactivos se conservan para no alterar el histórico de Power BI.
                </p>
              </div>
            </div>
            <div className="mc-catalog-grid">
              <CatalogManagement
                title="Marcas"
                items={allCatalogs.brands}
                kind="brand"
                action={catalogAction}
                onCreate={createCatalogItem}
                onToggle={setCatalogItemActive}
              />
              <CatalogManagement
                title="Negocios"
                items={allCatalogs.businesses}
                kind="business"
                action={catalogAction}
                onCreate={createCatalogItem}
                onToggle={setCatalogItemActive}
              />
            </div>
          </section>
        ) : null}

        {isLoading ? <p className="mc-state">Cargando metas…</p> : null}
        {!isLoading && groups.length === 0 ? (
          <section className="mc-empty">
            <h2>No hay metas para este período</h2>
            <p>
              {capabilities.canManageGoals
                ? 'Creá la primera meta para que quede disponible para Power BI.'
                : 'Probá otro período o consultá con un administrador de Meta Company.'}
            </p>
          </section>
        ) : null}
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
                    void saveGoal(goal, String(new FormData(event.currentTarget).get('value')));
                  }}
                >
                  <div>
                    <strong>{goal.brandName}</strong>
                    <span>
                      {goal.businessName} · Meta {goal.goalType}
                    </span>
                  </div>
                  {capabilities.canManageGoals ? (
                    <label>
                      Meta
                      <input
                        name="value"
                        defaultValue={goal.value}
                        inputMode="decimal"
                        aria-label={`Meta de ${goal.brandName}`}
                      />
                    </label>
                  ) : (
                    <output className="mc-goal-value">{goal.value}</output>
                  )}
                  {capabilities.canManageGoals ? (
                    <button className="mc-primary-action" disabled={savingId === goal.id}>
                      {savingId === goal.id ? 'Guardando…' : 'Guardar'}
                    </button>
                  ) : null}
                </form>
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}

interface CatalogManagementProps {
  title: string;
  items: CatalogItem[];
  kind: CatalogKind;
  action: string | undefined;
  onCreate: (kind: CatalogKind, form: HTMLFormElement) => Promise<void>;
  onToggle: (kind: CatalogKind, item: CatalogItem) => Promise<void>;
}

function CatalogManagement({
  title,
  items,
  kind,
  action,
  onCreate,
  onToggle,
}: CatalogManagementProps): React.JSX.Element {
  return (
    <section className="mc-catalog-section">
      <h3>{title}</h3>
      <form
        className="mc-catalog-create"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate(kind, event.currentTarget);
        }}
      >
        <label htmlFor={`mc-${kind}-name`}>
          {kind === 'brand' ? 'Nueva marca' : 'Nuevo negocio'}
        </label>
        <div>
          <input id={`mc-${kind}-name`} name="name" required />
          <button className="mc-secondary-action" disabled={action === `${kind}-create`}>
            {action === `${kind}-create` ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </form>
      <ul className="mc-catalog-list">
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.active ? 'Activo' : 'Inactivo'}</span>
            </div>
            <button
              type="button"
              className="mc-text-action"
              disabled={action === `${kind}-${item.id}`}
              onClick={() => void onToggle(kind, item)}
            >
              {item.active ? 'Desactivar' : 'Reactivar'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatPeriod(period: string): string {
  return new Intl.DateTimeFormat('es-PY', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period}-01T00:00:00.000Z`));
}

function reportFailure(error: unknown, context: BrowserOperationFailureContext): void {
  reportBrowserOperationFailed(error, {
    ...context,
    ...(error instanceof ApiHttpError ? { status: error.status, requestId: error.requestId } : {}),
  });
}
