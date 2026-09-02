import { useEffect, useMemo, useState } from 'react';
import { ApiHttpError } from '../../api/system';
import {
  reportBrowserOperationFailed,
  type BrowserOperationFailureContext,
} from '../../browser-diagnostics';
import { PlatformHeader } from '../../layout/platform-header';
import { PlatformSessionBar } from '../../layout/platform-session-bar';
import type { ApplicationComponentProps } from '../application-component';
import { AdvisorDetailScreen } from './advisor-detail-screen';
import { AdvisorGoalsListScreen } from './advisor-goals-list-screen';
import './meta-company-application.css';
import { buildAdvisorDetailPath, parseMetaCompanyRoute } from './meta-company-routes';

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
  const route = useMemo(
    () => parseMetaCompanyRoute(props.pathname, props.application.launchPath),
    [props.pathname, props.application.launchPath],
  );
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [allCatalogs, setAllCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [capabilities, setCapabilities] = useState<Capabilities>(NO_CAPABILITIES);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isManagingCatalogs, setIsManagingCatalogs] = useState(false);
  const [isManagingAdvisors, setIsManagingAdvisors] = useState(false);
  const [catalogAction, setCatalogAction] = useState<string>();

  const loadWorkspace = async (): Promise<void> => {
    setError(undefined);
    try {
      const loadedCapabilities = await props.api.applications.getMetaCompanyCapabilities();
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
      setError('No pudimos cargar los catálogos. Intentá nuevamente.');
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [props.api]);

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

  const isDetail = route.view === 'advisor-detail';

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
        breadcrumb={isDetail ? 'Detalle de asesor' : undefined}
        backLabel={isDetail ? 'Metas por asesor' : undefined}
        onBack={isDetail ? () => props.onNavigate(props.application.launchPath) : undefined}
        onNavigate={props.onNavigate}
        onLogout={props.onLogout}
      />
      <PlatformSessionBar session={props.session} />
      <section className="mc-page">
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

        {route.view === 'advisors' ? (
          <>
            <header className="mc-title">
              <div>
                <h1>Metas comerciales</h1>
                <p>Actualizá los valores que Power BI utilizará en sus reportes.</p>
              </div>
              <div className="mc-title-actions">
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

            <AdvisorGoalsListScreen
              year={year}
              onYearChange={setYear}
              canEdit={capabilities.canManageGoals}
              onSelectAdvisor={(advisorId) =>
                props.onNavigate(buildAdvisorDetailPath(props.application.launchPath, advisorId, year))
              }
            />
          </>
        ) : null}

        {route.view === 'advisor-detail' ? (
          <AdvisorDetailScreen
            advisorId={route.advisorId}
            year={route.year ?? year}
            canEdit={capabilities.canManageGoals}
            onNavigateYear={(newYear) => {
              setYear(newYear);
              props.onNavigate(
                buildAdvisorDetailPath(props.application.launchPath, route.advisorId, newYear),
              );
            }}
          />
        ) : null}

        {route.view === 'not-found' ? (
          <section className="mc-empty">
            <h2>No encontramos esta pantalla</h2>
            <p>Volvé a la lista de asesores e intentá de nuevo.</p>
          </section>
        ) : null}
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

function reportFailure(error: unknown, context: BrowserOperationFailureContext): void {
  reportBrowserOperationFailed(error, {
    ...context,
    ...(error instanceof ApiHttpError ? { status: error.status, requestId: error.requestId } : {}),
  });
}
