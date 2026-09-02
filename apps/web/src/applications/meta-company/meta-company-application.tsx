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
import { BrandGoalsListScreen } from './brand-goals-list-screen';
import { CatalogItemManagementScreen } from './catalog-item-management-screen';
import { EmpresaManagementScreen } from './empresa-management-screen';
import './meta-company-application.css';
import {
  buildAdvisorDetailPath,
  buildBrandGoalsPath,
  buildManageEmpresasPath,
  buildManageMarcasPath,
  buildManageNegociosPath,
  parseMetaCompanyRoute,
} from './meta-company-routes';
import { EMPTY_CATALOGS, NO_CAPABILITIES, type Advisor, type CatalogItem, type Catalogs, type Empresa } from './meta-company-types';

export function MetaCompanyApplication(props: ApplicationComponentProps): React.JSX.Element {
  const launchPath = props.application.launchPath;
  const route = useMemo(
    () => parseMetaCompanyRoute(props.pathname, launchPath),
    [props.pathname, launchPath],
  );
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [allCatalogs, setAllCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [capabilities, setCapabilities] = useState(NO_CAPABILITIES);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isManagingAdvisors, setIsManagingAdvisors] = useState(false);
  const [catalogAction, setCatalogAction] = useState<string>();

  const loadWorkspace = async (): Promise<void> => {
    setError(undefined);
    try {
      const [loadedCatalogs, loadedCapabilities] = await Promise.all([
        props.api.applications.listMetaCompanyCatalogs(),
        props.api.applications.getMetaCompanyCapabilities(),
      ]);
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
      setError('No pudimos cargar los catálogos. Intentá nuevamente.');
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [props.api]);

  const saveEmpresa = async (
    input: { code: string; name: string },
    editingId: number | undefined,
  ): Promise<void> => {
    setCatalogAction(editingId === undefined ? 'empresa-create' : `empresa-edit-${editingId}`);
    setError(undefined);
    setNotice(undefined);
    try {
      if (editingId === undefined) {
        await props.api.applications.createMetaCompanyEmpresa(input);
      } else {
        await props.api.applications.updateMetaCompanyEmpresa(editingId, input);
      }
      await loadWorkspace();
      setNotice(editingId === undefined ? 'Empresa creada.' : 'Empresa actualizada.');
    } catch (creationError: unknown) {
      reportFailure(creationError, {
        operation: 'meta-company.save-empresa',
        method: editingId === undefined ? 'POST' : 'PATCH',
        route: '/api/applications/meta-company/empresas',
        provider: 'api',
      });
      setError('No pudimos guardar la empresa. Revisá los datos e intentá nuevamente.');
      throw creationError;
    } finally {
      setCatalogAction(undefined);
    }
  };

  const toggleEmpresaActive = async (empresa: Empresa): Promise<void> => {
    setCatalogAction(`empresa-${empresa.id}`);
    setError(undefined);
    setNotice(undefined);
    try {
      await props.api.applications.setMetaCompanyEmpresaActive(empresa.id, !empresa.active);
      await loadWorkspace();
      setNotice(empresa.active ? `${empresa.name} fue desactivada.` : `${empresa.name} fue reactivada.`);
    } catch (statusError: unknown) {
      reportFailure(statusError, {
        operation: 'meta-company.update-empresa-status',
        method: 'PATCH',
        route: '/api/applications/meta-company/empresas/:id/active',
        provider: 'api',
      });
      setError('No pudimos actualizar el estado de la empresa. Intentá nuevamente.');
    } finally {
      setCatalogAction(undefined);
    }
  };

  const saveCatalogItem = async (
    kind: 'brand' | 'business',
    input: { empresaId: number; name: string },
    editingId: number | undefined,
  ): Promise<void> => {
    setCatalogAction(editingId === undefined ? `${kind}-create` : `${kind}-edit-${editingId}`);
    setError(undefined);
    setNotice(undefined);
    try {
      if (kind === 'brand') {
        if (editingId === undefined) await props.api.applications.createMetaCompanyBrand(input);
        else await props.api.applications.updateMetaCompanyBrand(editingId, input);
      } else if (editingId === undefined) {
        await props.api.applications.createMetaCompanyBusiness(input);
      } else {
        await props.api.applications.updateMetaCompanyBusiness(editingId, input);
      }
      await loadWorkspace();
      const label = kind === 'brand' ? 'Marca' : 'Negocio';
      setNotice(editingId === undefined ? `${label} creado.` : `${label} actualizado.`);
    } catch (creationError: unknown) {
      reportFailure(creationError, {
        operation: 'meta-company.save-catalog-item',
        method: editingId === undefined ? 'POST' : 'PATCH',
        route: `/api/applications/meta-company/${kind === 'brand' ? 'brands' : 'businesses'}`,
        provider: 'api',
      });
      setError(kind === 'brand' ? 'No pudimos guardar la marca.' : 'No pudimos guardar el negocio.');
      throw creationError;
    } finally {
      setCatalogAction(undefined);
    }
  };

  const toggleCatalogItemActive = async (kind: 'brand' | 'business', item: CatalogItem): Promise<void> => {
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
        operation: 'meta-company.update-catalog-status',
        method: 'PATCH',
        route: `/api/applications/meta-company/${kind === 'brand' ? 'brands' : 'businesses'}/:id/active`,
        provider: 'api',
      });
      setError('No pudimos actualizar el estado. Intentá nuevamente.');
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

  const isHome = route.view === 'advisors' || route.view === 'brands';
  const managementBreadcrumbs: Partial<Record<typeof route.view, string>> = {
    'advisor-detail': 'Detalle de asesor',
    'manage-empresas': 'Gestión de empresas',
    'manage-negocios': 'Gestión de negocios',
    'manage-marcas': 'Gestión de marcas',
  };
  const breadcrumb = managementBreadcrumbs[route.view];

  return (
    <main className="platform-shell meta-company-shell">
      <PlatformHeader
        applications={props.availableApplications}
        applicationName={props.application.name}
        applicationLaunchPath={launchPath}
        isLoggingOut={props.isLoggingOut}
        isPlatformAdministrator={props.session.isPlatformAdministrator}
        showAdministrationLink={false}
        variant="application"
        breadcrumb={breadcrumb}
        backLabel={breadcrumb === undefined ? undefined : 'Metas comerciales'}
        onBack={breadcrumb === undefined ? undefined : () => props.onNavigate(launchPath)}
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

        {isHome ? (
          <>
            <header className="mc-title">
              <div>
                <h1>Metas comerciales</h1>
                <p>Actualizá los valores que Power BI utilizará en sus reportes.</p>
              </div>
              <div className="mc-title-actions">
                {capabilities.canManageCatalogs ? (
                  <>
                    <button
                      type="button"
                      className="mc-secondary-action"
                      onClick={() => props.onNavigate(buildManageEmpresasPath(launchPath))}
                    >
                      Gestionar empresas
                    </button>
                    <button
                      type="button"
                      className="mc-secondary-action"
                      onClick={() => props.onNavigate(buildManageNegociosPath(launchPath))}
                    >
                      Gestionar negocios
                    </button>
                    <button
                      type="button"
                      className="mc-secondary-action"
                      onClick={() => props.onNavigate(buildManageMarcasPath(launchPath))}
                    >
                      Gestionar marcas
                    </button>
                  </>
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

            <div className="mc-mode-switch" role="group" aria-label="Tipo de metas">
              <button
                type="button"
                className={route.view === 'advisors' ? 'is-active' : ''}
                onClick={() => props.onNavigate(launchPath)}
              >
                Por asesor
              </button>
              <button
                type="button"
                className={route.view === 'brands' ? 'is-active' : ''}
                onClick={() => props.onNavigate(buildBrandGoalsPath(launchPath))}
              >
                Por marca
              </button>
            </div>

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

            {route.view === 'advisors' ? (
              <AdvisorGoalsListScreen
                advisors={catalogs.advisors}
                year={year}
                onYearChange={setYear}
                canEdit={capabilities.canManageGoals}
                onSelectAdvisor={(advisorId) =>
                  props.onNavigate(buildAdvisorDetailPath(launchPath, advisorId, year))
                }
              />
            ) : (
              <BrandGoalsListScreen
                brands={catalogs.brands}
                year={year}
                onYearChange={setYear}
                canEdit={capabilities.canManageGoals}
              />
            )}
          </>
        ) : null}

        {route.view === 'advisor-detail' ? (
          <AdvisorDetailScreen
            advisorId={route.advisorId}
            advisors={catalogs.advisors}
            year={route.year ?? year}
            canEdit={capabilities.canManageGoals}
            onNavigateYear={(newYear) => {
              setYear(newYear);
              props.onNavigate(buildAdvisorDetailPath(launchPath, route.advisorId, newYear));
            }}
          />
        ) : null}

        {route.view === 'manage-empresas' ? (
          <EmpresaManagementScreen
            empresas={allCatalogs.empresas}
            action={catalogAction}
            onSave={saveEmpresa}
            onToggle={toggleEmpresaActive}
          />
        ) : null}

        {route.view === 'manage-negocios' ? (
          <CatalogItemManagementScreen
            kind="business"
            title="Negocios"
            items={allCatalogs.businesses}
            empresas={allCatalogs.empresas}
            action={catalogAction}
            onSave={(input, editingId) => saveCatalogItem('business', input, editingId)}
            onToggle={(item) => toggleCatalogItemActive('business', item)}
          />
        ) : null}

        {route.view === 'manage-marcas' ? (
          <CatalogItemManagementScreen
            kind="brand"
            title="Marcas"
            items={allCatalogs.brands}
            empresas={allCatalogs.empresas}
            action={catalogAction}
            onSave={(input, editingId) => saveCatalogItem('brand', input, editingId)}
            onToggle={(item) => toggleCatalogItemActive('brand', item)}
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
      <form className="mc-manage-form" onSubmit={(event) => void submit(event)}>
        <div className="mc-workbench-heading">
          <h3>{editingId === undefined ? 'Nuevo asesor' : 'Editar asesor'}</h3>
          {editingId === undefined ? null : (
            <button type="button" className="mc-text-action" onClick={resetForm}>
              Cancelar edición
            </button>
          )}
        </div>
        <div className="mc-manage-form-grid">
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
      <div className="mc-manage-table-wrapper">
        <table className="mc-manage-table">
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
                <td className="mc-manage-actions">
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
