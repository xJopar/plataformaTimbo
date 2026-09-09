import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiHttpError, type AdministrativeApplication, type Api } from '../api';
import { ApplicationProfilesPanel } from './application-profiles-panel';

type ApplicationsState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error' }
  | { status: 'ready'; applications: AdministrativeApplication[] };

interface ApplicationFormValues {
  key: string;
  name: string;
  description: string;
  launchPath: string;
  displayOrder: string;
}

const EMPTY_FORM: ApplicationFormValues = {
  key: '',
  name: '',
  description: '',
  launchPath: '/apps/',
  displayOrder: '0',
};

export function ApplicationsPanel({ api }: { api: Api }): React.JSX.Element {
  const [state, setState] = useState<ApplicationsState>({ status: 'loading' });
  const [form, setForm] = useState<ApplicationFormValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [managedApplicationId, setManagedApplicationId] = useState<string | undefined>(undefined);

  const loadApplications = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    setActionError(undefined);
    try {
      setState({ status: 'ready', applications: await api.administration.listApplications() });
    } catch (error) {
      setState(
        error instanceof ApiHttpError && error.status === 403
          ? { status: 'forbidden' }
          : { status: 'error' },
      );
    }
  }, [api]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (managedApplicationId === undefined) {
      return;
    }

    const profilesPanel = document.getElementById(
      `application-profiles-panel-${managedApplicationId}`,
    );
    if (typeof profilesPanel?.scrollIntoView === 'function') {
      profilesPanel.scrollIntoView({ block: 'start' });
    }
  }, [managedApplicationId]);

  const updateForm = (field: keyof ApplicationFormValues, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = (): void => {
    setEditingId(undefined);
    setForm(EMPTY_FORM);
  };

  const beginEditing = (application: AdministrativeApplication): void => {
    setEditingId(application.id);
    setForm({
      key: application.key,
      name: application.name,
      description: application.description ?? '',
      launchPath: application.launchPath,
      displayOrder: application.displayOrder.toString(),
    });
    setActionError(undefined);
  };

  const saveApplication = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    setActionError(undefined);
    const values = {
      name: form.name,
      description: form.description.trim() || null,
      launchPath: form.launchPath,
      displayOrder: Number(form.displayOrder),
    };
    try {
      if (editingId === undefined) {
        await api.administration.createApplication({ key: form.key, ...values });
      } else {
        await api.administration.updateApplication(editingId, values);
      }
      resetForm();
      await loadApplications();
    } catch (error) {
      setActionError(
        error instanceof ApiHttpError && error.status === 409
          ? 'Ya existe una aplicación con esa clave o ruta.'
          : 'No pudimos guardar la aplicación. Revisá los datos e intentá nuevamente.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const changeStatus = async (application: AdministrativeApplication): Promise<void> => {
    setIsSaving(true);
    setActionError(undefined);
    try {
      if (application.status === 'ACTIVE') {
        await api.administration.deactivateApplication(application.id);
      } else {
        await api.administration.reactivateApplication(application.id);
      }
      await loadApplications();
    } catch {
      setActionError('No pudimos cambiar el estado de la aplicación. Intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const managedApplication =
    state.status === 'ready' && managedApplicationId !== undefined
      ? state.applications.find((application) => application.id === managedApplicationId)
      : undefined;

  return (
    <section
      className="administration-content applications-content"
      aria-labelledby="applications-title"
    >
      <h1 id="applications-title">Aplicaciones</h1>
      <p className="administration-description">
        Mantené el catálogo de rutas internas disponibles en Plataforma Timbo.
      </p>
      {state.status === 'loading' ? <p aria-live="polite">Cargando aplicaciones…</p> : null}
      {state.status === 'forbidden' ? (
        <section className="state-surface" aria-labelledby="applications-forbidden-title">
          <h2 id="applications-forbidden-title">No tenés permiso para ver Aplicaciones</h2>
          <p>Solicitá a un administrador de plataforma que revise tu asignación.</p>
        </section>
      ) : null}
      {state.status === 'error' ? (
        <section className="state-surface" aria-labelledby="applications-error-title">
          <h2 id="applications-error-title">No pudimos cargar Aplicaciones</h2>
          <p>La información no está disponible en este momento.</p>
          <button className="action-button" type="button" onClick={() => void loadApplications()}>
            Reintentar
          </button>
        </section>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <form className="application-form" onSubmit={(event) => void saveApplication(event)}>
            <div className="application-form-heading">
              <h2>{editingId === undefined ? 'Agregar aplicación' : 'Editar aplicación'}</h2>
              {editingId === undefined ? null : (
                <button className="text-button" type="button" onClick={resetForm}>
                  Cancelar edición
                </button>
              )}
            </div>
            <div className="application-form-grid">
              <label>
                Clave
                <input
                  required
                  disabled={editingId !== undefined}
                  value={form.key}
                  onChange={(event) => updateForm('key', event.target.value)}
                  placeholder="lista-de-precios"
                />
              </label>
              <label>
                Nombre
                <input
                  required
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                />
              </label>
              <label>
                Ruta interna
                <input
                  required
                  value={form.launchPath}
                  onChange={(event) => updateForm('launchPath', event.target.value)}
                />
              </label>
              <label>
                Orden
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={form.displayOrder}
                  onChange={(event) => updateForm('displayOrder', event.target.value)}
                />
              </label>
              <label className="application-description-field">
                Descripción (opcional)
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                />
              </label>
            </div>
            <button className="action-button" type="submit" disabled={isSaving}>
              {isSaving
                ? 'Guardando…'
                : editingId === undefined
                  ? 'Agregar aplicación'
                  : 'Guardar cambios'}
            </button>
          </form>
          {actionError === undefined ? null : <p role="alert">{actionError}</p>}
          {managedApplication === undefined ? null : (
            <ApplicationProfilesPanel
              api={api}
              application={managedApplication}
              onClose={() => setManagedApplicationId(undefined)}
            />
          )}
          {state.applications.length === 0 ? (
            <section className="state-surface" aria-labelledby="empty-applications-title">
              <h2 id="empty-applications-title">Todavía no hay aplicaciones</h2>
              <p>Agregá la primera ruta interna para comenzar el catálogo.</p>
            </section>
          ) : (
            <div className="applications-table-wrapper">
              <table>
                <caption>Catálogo de aplicaciones</caption>
                <thead>
                  <tr>
                    <th scope="col">Aplicación</th>
                    <th scope="col">Ruta</th>
                    <th scope="col">Orden</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {state.applications.map((application) => (
                    <tr key={application.id}>
                      <td>
                        <strong>{application.name}</strong>
                        <span className="application-key">{application.key}</span>
                        {application.description === null ? null : (
                          <span>{application.description}</span>
                        )}
                      </td>
                      <td>
                        <code>{application.launchPath}</code>
                      </td>
                      <td>{application.displayOrder}</td>
                      <td>{application.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</td>
                      <td className="user-actions">
                        {application.status === 'ACTIVE' ? (
                          <a className="text-link" href={application.launchPath}>
                            Abrir
                          </a>
                        ) : null}
                        <button
                          className="text-button"
                          type="button"
                          disabled={isSaving}
                          onClick={() => beginEditing(application)}
                        >
                          Editar
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          disabled={isSaving}
                          aria-controls={`application-profiles-panel-${application.id}`}
                          aria-expanded={managedApplicationId === application.id}
                          onClick={() =>
                            setManagedApplicationId((currentApplicationId) =>
                              currentApplicationId === application.id ? undefined : application.id,
                            )
                          }
                        >
                          Gestionar perfiles
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          disabled={isSaving}
                          onClick={() => void changeStatus(application)}
                        >
                          {application.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
