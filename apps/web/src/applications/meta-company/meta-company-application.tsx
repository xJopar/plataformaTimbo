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
type Advisor = Catalogs['advisors'][number];
type Capabilities = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['getMetaCompanyCapabilities']>
>;
type CatalogKind = 'brand' | 'business';

const EMPTY_CATALOGS: Catalogs = { empresas: [], brands: [], businesses: [], advisors: [] };
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
  const [isManagingAdvisors, setIsManagingAdvisors] = useState(false);
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
      const updatedGoal =
        goal.goalType === 'Marca'
          ? mapBrandGoalToListItem(
              await props.api.applications.updateMetaCompanyBrandGoal(goal.id, value),
            )
          : mapAdvisorGoalToListItem(
              await props.api.applications.updateMetaCompanyAdvisorGoal(goal.id, value),
            );
      setGoals((items) => items.map((item) => (item.id === goal.id ? updatedGoal : item)));
      setNotice('Meta actualizada.');
    } catch (saveError: unknown) {
      reportFailure(saveError, {
        operation: 'meta-company.update-goal',
        method: 'PATCH',
        route: '/api/applications/meta-company/{brand,advisor}-goals/:id',
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
    const brandIdText = String(values.get('brandId') ?? '').trim();
    setCatalogAction('goal');
    setError(undefined);
    setNotice(undefined);
    try {
      const createdGoal =
        goalType === 'Marca'
          ? mapBrandGoalToListItem(
              await props.api.applications.createMetaCompanyBrandGoal({
                period: `${period}-01`,
                businessId: Number(values.get('businessId')),
                brandId: Number(brandIdText),
                value: String(values.get('value')),
              }),
            )
          : mapAdvisorGoalToListItem(
              await props.api.applications.createMetaCompanyAdvisorGoal({
                period: `${period}-01`,
                businessId: Number(values.get('businessId')),
                ...(brandIdText === '' ? {} : { brandId: Number(brandIdText) }),
                advisorId: Number(values.get('advisorId')),
                value: String(values.get('value')),
              }),
            );
      setGoals((items) => [...items, createdGoal]);
      setIsCreatingGoal(false);
      setNotice('Meta creada.');
    } catch (creationError: unknown) {
      reportFailure(creationError, {
        operation: 'meta-company.create-goal',
        method: 'POST',
        route: '/api/applications/meta-company/{brand,advisor}-goals',
        provider: 'api',
      });
      setError('No pudimos crear la meta. Verificá los datos e intentá nuevamente.');
    } finally {
      setCatalogAction(undefined);
    }
  };

  const createCatalogItem = async (kind: CatalogKind, form: HTMLFormElement): Promise<void> => {
    const values = new FormData(form);
    const name = String(values.get('name') ?? '');
    const empresaId = Number(values.get('empresaId'));
    setCatalogAction(`${kind}-create`);
    setError(undefined);
    setNotice(undefined);
    try {
      if (kind === 'brand') {
        await props.api.applications.createMetaCompanyBrand({ empresaId, name });
      } else {
        await props.api.applications.createMetaCompanyBusiness({ empresaId, name });
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

  const saveAdvisor = async (
    input: {
      empresaId: number;
      sourceSystem: string;
      externalCode: string;
      displayName: string;
      kind: 'PERSON' | 'SALES_CHANNEL';
    },
    editingId: number | undefined,
  ): Promise<void> => {
    setCatalogAction(editingId === undefined ? 'advisor-create' : `advisor-edit-${editingId}`);
    setError(undefined);
    setNotice(undefined);
    try {
      if (editingId === undefined) {
        await props.api.applications.createMetaCompanyAdvisor(input);
      } else {
        await props.api.applications.updateMetaCompanyAdvisor(editingId, input);
      }
      await loadWorkspace();
      setNotice(editingId === undefined ? 'Asesor creado.' : 'Asesor actualizado.');
    } catch (creationError: unknown) {
      reportFailure(creationError, {
        operation: 'meta-company.save-advisor',
        method: editingId === undefined ? 'POST' : 'PATCH',
        route: '/api/applications/meta-company/advisors',
        provider: 'api',
      });
      setError('No pudimos guardar el asesor. Revisá los datos e intentá nuevamente.');
      throw creationError;
    } finally {
      setCatalogAction(undefined);
    }
  };

  const toggleAdvisorActive = async (advisor: Advisor): Promise<void> => {
    setCatalogAction(`advisor-${advisor.id}`);
    setError(undefined);
    setNotice(undefined);
    try {
      await props.api.applications.setMetaCompanyAdvisorActive(advisor.id, !advisor.active);
      await loadWorkspace();
      setNotice(advisor.active ? `${advisor.displayName} fue desactivado.` : `${advisor.displayName} fue reactivado.`);
    } catch (statusError: unknown) {
      reportFailure(statusError, {
        operation: 'meta-company.update-advisor-status',
        method: 'PATCH',
        route: '/api/applications/meta-company/advisors/:id/active',
        provider: 'api',
      });
      setError('No pudimos actualizar el estado del asesor. Intentá nuevamente.');
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
            {capabilities.canManageCatalogs ? (
              <button
                type="button"
                className="mc-secondary-action"
                aria-expanded={isManagingAdvisors}
                onClick={() => setIsManagingAdvisors((visible) => !visible)}
              >
                Gestionar asesores
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
                  Elegí el negocio y la marca. Para una meta por vendedor, elegí el asesor.
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
                Marca{' '}
                <span>
                  {newGoalType === 'Marca' ? 'Obligatoria' : 'Opcional para meta por vendedor'}
                </span>
                <select
                  name="brandId"
                  required={newGoalType === 'Marca'}
                  defaultValue=""
                >
                  <option value="">
                    {newGoalType === 'Marca' ? 'Seleccioná una marca' : 'No aplica'}
                  </option>
                  {catalogs.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Asesor{' '}
                <span>
                  {newGoalType === 'Vendedor'
                    ? 'Obligatorio para meta por vendedor'
                    : 'No aplica a una meta por marca'}
                </span>
                <select
                  name="advisorId"
                  disabled={newGoalType === 'Marca'}
                  required={newGoalType === 'Vendedor'}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Seleccioná un asesor
                  </option>
                  {catalogs.advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.displayName} ({advisor.externalCode})
                    </option>
                  ))}
                </select>
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
                empresas={allCatalogs.empresas}
                kind="brand"
                action={catalogAction}
                onCreate={createCatalogItem}
              />
              <CatalogManagement
                title="Negocios"
                items={allCatalogs.businesses}
                empresas={allCatalogs.empresas}
                kind="business"
                action={catalogAction}
                onCreate={createCatalogItem}
              />
            </div>
          </section>
        ) : null}

        {isManagingAdvisors ? (
          <section className="mc-workbench" aria-labelledby="mc-advisor-title">
            <div className="mc-workbench-heading">
              <div>
                <h2 id="mc-advisor-title">Asesores</h2>
                <p>Los asesores inactivos dejan de estar disponibles para nuevas metas.</p>
              </div>
            </div>
            <AdvisorManagement
              advisors={allCatalogs.advisors}
              empresas={allCatalogs.empresas}
              action={catalogAction}
              onSave={saveAdvisor}
              onToggle={toggleAdvisorActive}
            />
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
  empresas: Catalogs['empresas'];
  kind: CatalogKind;
  action: string | undefined;
  onCreate: (kind: CatalogKind, form: HTMLFormElement) => Promise<void>;
}

function CatalogManagement({
  title,
  items,
  empresas,
  kind,
  action,
  onCreate,
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
        <label htmlFor={`mc-${kind}-empresa`}>Empresa</label>
        <select id={`mc-${kind}-empresa`} name="empresaId" required defaultValue="">
          <option value="" disabled>
            Seleccioná una empresa
          </option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.name}
            </option>
          ))}
        </select>
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
          </li>
        ))}
      </ul>
    </section>
  );
}

interface AdvisorFormValues {
  empresaId: string;
  sourceSystem: string;
  externalCode: string;
  displayName: string;
  kind: 'PERSON' | 'SALES_CHANNEL';
}

const EMPTY_ADVISOR_FORM: AdvisorFormValues = {
  empresaId: '',
  sourceSystem: '',
  externalCode: '',
  displayName: '',
  kind: 'PERSON',
};

interface AdvisorManagementProps {
  advisors: Advisor[];
  empresas: Catalogs['empresas'];
  action: string | undefined;
  onSave: (
    input: {
      empresaId: number;
      sourceSystem: string;
      externalCode: string;
      displayName: string;
      kind: 'PERSON' | 'SALES_CHANNEL';
    },
    editingId: number | undefined,
  ) => Promise<void>;
  onToggle: (advisor: Advisor) => Promise<void>;
}

function AdvisorManagement({
  advisors,
  empresas,
  action,
  onSave,
  onToggle,
}: AdvisorManagementProps): React.JSX.Element {
  const [form, setForm] = useState<AdvisorFormValues>(EMPTY_ADVISOR_FORM);
  const [editingId, setEditingId] = useState<number>();

  const updateForm = (field: keyof AdvisorFormValues, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }) as AdvisorFormValues);
  };

  const resetForm = (): void => {
    setEditingId(undefined);
    setForm(EMPTY_ADVISOR_FORM);
  };

  const beginEditing = (advisor: Advisor): void => {
    setEditingId(advisor.id);
    setForm({
      empresaId: String(advisor.empresaId),
      sourceSystem: advisor.sourceSystem,
      externalCode: advisor.externalCode,
      displayName: advisor.displayName,
      kind: advisor.kind,
    });
  };

  const isSaving =
    action === 'advisor-create' || (editingId !== undefined && action === `advisor-edit-${editingId}`);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    try {
      await onSave(
        {
          empresaId: Number(form.empresaId),
          sourceSystem: form.sourceSystem,
          externalCode: form.externalCode,
          displayName: form.displayName,
          kind: form.kind,
        },
        editingId,
      );
      resetForm();
    } catch {
      // el error ya se reporta en el estado compartido de la página
    }
  };

  return (
    <>
      <form className="mc-advisor-form" onSubmit={(event) => void submit(event)}>
        <div className="mc-workbench-heading">
          <h3>{editingId === undefined ? 'Nuevo asesor' : 'Editar asesor'}</h3>
          {editingId === undefined ? null : (
            <button type="button" className="mc-text-action" onClick={resetForm}>
              Cancelar edición
            </button>
          )}
        </div>
        <div className="mc-advisor-form-grid">
          <label>
            Empresa
            <select
              required
              value={form.empresaId}
              onChange={(event) => updateForm('empresaId', event.target.value)}
            >
              <option value="" disabled>
                Seleccioná una empresa
              </option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sistema de origen
            <input
              required
              placeholder="SAP_B1"
              value={form.sourceSystem}
              onChange={(event) => updateForm('sourceSystem', event.target.value)}
            />
          </label>
          <label>
            Código externo
            <input
              required
              value={form.externalCode}
              onChange={(event) => updateForm('externalCode', event.target.value)}
            />
          </label>
          <label>
            Nombre visible
            <input
              required
              value={form.displayName}
              onChange={(event) => updateForm('displayName', event.target.value)}
            />
          </label>
          <label>
            Tipo
            <select
              value={form.kind}
              onChange={(event) => updateForm('kind', event.target.value)}
            >
              <option value="PERSON">Persona</option>
              <option value="SALES_CHANNEL">Canal de venta</option>
            </select>
          </label>
        </div>
        <button className="mc-primary-action" disabled={isSaving}>
          {isSaving ? 'Guardando…' : editingId === undefined ? 'Agregar asesor' : 'Guardar cambios'}
        </button>
      </form>
      <div className="mc-advisor-table-wrapper">
        <table className="mc-advisor-table">
          <caption>Asesores registrados</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Empresa</th>
              <th scope="col">Sistema · Código</th>
              <th scope="col">Tipo</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {advisors.map((advisor) => (
              <tr key={advisor.id}>
                <td>{advisor.displayName}</td>
                <td>{empresas.find((empresa) => empresa.id === advisor.empresaId)?.name ?? '—'}</td>
                <td>
                  <code>
                    {advisor.sourceSystem} · {advisor.externalCode}
                  </code>
                </td>
                <td>{advisor.kind === 'PERSON' ? 'Persona' : 'Canal de venta'}</td>
                <td>{advisor.active ? 'Activo' : 'Inactivo'}</td>
                <td className="mc-advisor-actions">
                  <button
                    type="button"
                    className="mc-text-action"
                    disabled={isSaving}
                    onClick={() => beginEditing(advisor)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="mc-text-action"
                    disabled={action === `advisor-${advisor.id}`}
                    onClick={() => void onToggle(advisor)}
                  >
                    {advisor.active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function mapBrandGoalToListItem(goal: {
  id: number;
  period: string;
  businessId: number;
  businessName: string;
  brandId: number;
  brandName: string;
  value: string;
  updatedAt?: string | null;
}): Goal {
  return {
    id: goal.id,
    period: goal.period,
    businessId: goal.businessId,
    businessName: goal.businessName,
    brandId: goal.brandId,
    brandName: goal.brandName,
    salespersonCode: null,
    goalType: 'Marca',
    value: goal.value,
    updatedAt: goal.updatedAt ?? null,
  };
}

function mapAdvisorGoalToListItem(goal: {
  id: number;
  period: string;
  businessId: number;
  businessName: string;
  brandId?: number | null;
  brandName?: string | null;
  advisorCode: string;
  value: string;
  updatedAt?: string | null;
}): Goal {
  const advisorCode = Number(goal.advisorCode);
  return {
    id: goal.id,
    period: goal.period,
    businessId: goal.businessId,
    businessName: goal.businessName,
    brandId: goal.brandId ?? null,
    brandName: goal.brandName ?? 'No aplica',
    salespersonCode: Number.isSafeInteger(advisorCode) ? advisorCode : null,
    goalType: 'Vendedor',
    value: goal.value,
    updatedAt: goal.updatedAt ?? null,
  };
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
