import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ApiHttpError,
  type AdministrativeApplication,
  type AdministrativeUser,
  type Api,
  type BulkApplicationAccessResult,
  type BulkAdministrativeUserStatusResult,
} from '../api';
import { reportBrowserOperationFailed } from '../browser-diagnostics';

interface UsersPanelProps {
  api: Api;
  onNavigate: (pathname: string) => void;
}

type UsersState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error' }
  | { status: 'ready'; users: AdministrativeUser[]; search: string };

export function UsersPanel({ api, onNavigate }: UsersPanelProps): React.JSX.Element {
  const [state, setState] = useState<UsersState>({ status: 'loading' });
  const [search, setSearch] = useState('');
  const [applications, setApplications] = useState<AdministrativeApplication[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [applicationId, setApplicationId] = useState('');
  const [isUnassignConfirmed, setIsUnassignConfirmed] = useState(false);
  const [results, setResults] = useState<BulkApplicationAccessResult[] | undefined>(undefined);
  const [statusResults, setStatusResults] = useState<
    BulkAdministrativeUserStatusResult[] | undefined
  >(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeactivationConfirmed, setIsDeactivationConfirmed] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const loadUsers = useCallback(
    async (nextSearch = '', clearSelection = true): Promise<void> => {
      setState({ status: 'loading' });
      setError(undefined);
      if (clearSelection) {
        setSelectedUserIds(new Set());
        setResults(undefined);
        setStatusResults(undefined);
      }
      try {
        const users = await api.administration.listUsers(nextSearch || undefined);
        setState({ status: 'ready', users, search: nextSearch });
      } catch (loadError) {
        reportBrowserOperationFailed(loadError, {
          operation: 'administration.manage-users',
          method: 'GET',
          route: '/api/admin/users',
          provider: 'api',
          ...(loadError instanceof ApiHttpError ? { status: loadError.status } : {}),
        });
        setState(
          loadError instanceof ApiHttpError && loadError.status === 403
            ? { status: 'forbidden' }
            : { status: 'error' },
        );
      }
    },
    [api],
  );

  useEffect(() => {
    void loadUsers();
    const loadApplications = async (): Promise<void> => {
      try {
        setApplications(await api.administration.listApplications());
        setApplicationsError(undefined);
      } catch (loadError) {
        reportBrowserOperationFailed(loadError, {
          operation: 'administration.load-applications',
          method: 'GET',
          route: '/api/admin/applications',
          provider: 'api',
          ...(loadError instanceof ApiHttpError ? { status: loadError.status } : {}),
        });
        setApplicationsError('No pudimos cargar las aplicaciones para la acción masiva.');
      }
    };
    void loadApplications();
  }, [api, loadUsers]);

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadUsers(search);
  };

  const toggleUserSelection = (userId: string): void => {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAllUsers = (users: AdministrativeUser[]): void => {
    setSelectedUserIds((current) =>
      current.size === users.length ? new Set() : new Set(users.map((user) => user.id)),
    );
  };

  const runBulkAccessAction = async (action: 'assign' | 'unassign'): Promise<void> => {
    if (applicationId === '' || selectedUserIds.size === 0) return;
    setIsSaving(true);
    setError(undefined);
    setResults(undefined);
    try {
      const userIds = Array.from(selectedUserIds);
      const nextResults =
        action === 'assign'
          ? await api.administration.assignApplicationToUsers(applicationId, userIds)
          : await api.administration.unassignApplicationFromUsers(applicationId, userIds);
      setResults(nextResults);
      setIsUnassignConfirmed(false);
    } catch (operationError) {
      reportBrowserOperationFailed(operationError, {
        operation: 'administration.manage-users',
        method: 'POST',
        route:
          action === 'assign'
            ? '/api/admin/applications/{applicationId}/users/bulk-assign'
            : '/api/admin/applications/{applicationId}/users/bulk-unassign',
        provider: 'api',
        ...(operationError instanceof ApiHttpError ? { status: operationError.status } : {}),
      });
      setError('No pudimos completar la operación en lote. Intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const runBulkStatusAction = async (status: 'activate' | 'deactivate'): Promise<void> => {
    if (selectedUserIds.size === 0) return;
    setIsSaving(true);
    setError(undefined);
    setStatusResults(undefined);
    try {
      const userIds = Array.from(selectedUserIds);
      const nextResults =
        status === 'activate'
          ? await api.administration.activateUsers(userIds)
          : await api.administration.deactivateUsers(userIds);
      setStatusResults(nextResults);
      setIsDeactivationConfirmed(false);
      await loadUsers(state.status === 'ready' ? state.search : search, false);
    } catch (operationError) {
      reportBrowserOperationFailed(operationError, {
        operation: 'administration.manage-users',
        method: 'POST',
        route:
          status === 'activate'
            ? '/api/admin/users/bulk-activate'
            : '/api/admin/users/bulk-deactivate',
        provider: 'api',
        ...(operationError instanceof ApiHttpError ? { status: operationError.status } : {}),
      });
      setError('No pudimos actualizar el estado de los usuarios. Intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="administration-content" aria-labelledby="administration-title">
      <div className="administration-page-heading">
        <div>
          <h1 id="administration-title">Usuarios</h1>
          <p className="administration-description">
            Consultá las personas preautorizadas y administrá sus accesos.
          </p>
        </div>
        <a
          className="action-button"
          href="/admin/users/preauthorize"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/admin/users/preauthorize');
          }}
        >
          Preautorizar usuarios
        </a>
      </div>
      {state.status === 'loading' ? <p aria-live="polite">Cargando usuarios…</p> : null}
      {state.status === 'forbidden' ? (
        <section className="state-surface" aria-labelledby="forbidden-title">
          <h2 id="forbidden-title">No tenés permiso para ver Usuarios</h2>
          <p>Solicitá a un administrador de plataforma que revise tu asignación.</p>
        </section>
      ) : null}
      {state.status === 'error' ? (
        <section className="state-surface" aria-labelledby="administration-error-title">
          <h2 id="administration-error-title">No pudimos cargar Usuarios</h2>
          <p>La información no está disponible en este momento.</p>
          <button className="action-button" type="button" onClick={() => void loadUsers(search)}>
            Reintentar
          </button>
        </section>
      ) : null}
      {state.status !== 'ready' ? null : (
        <>
          <form className="search-form" onSubmit={submitSearch} role="search">
            <label htmlFor="user-search">Buscar por nombre o correo</label>
            <div>
              <input
                id="user-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="action-button" type="submit" disabled={isSaving}>
                Buscar
              </button>
            </div>
          </form>
          {error === undefined ? null : <p role="alert">{error}</p>}
          {state.users.length === 0 ? (
            <section className="state-surface" aria-labelledby="empty-users-title">
              <h2 id="empty-users-title">No encontramos usuarios</h2>
              <p>
                {state.search.length === 0
                  ? 'Todavía no hay usuarios preautorizados.'
                  : 'Probá con otro nombre o correo.'}
              </p>
            </section>
          ) : (
            <>
              {selectedUserIds.size === 0 ? null : (
                <section className="bulk-access-bar" aria-label="Accesos masivos">
                  <p>
                    {selectedUserIds.size} usuario{selectedUserIds.size === 1 ? '' : 's'}{' '}
                    seleccionado
                    {selectedUserIds.size === 1 ? '' : 's'}.
                  </p>
                  {applicationsError === undefined ? (
                    <div className="bulk-application-field">
                      <label htmlFor="bulk-access-application">Aplicación</label>
                      <select
                        id="bulk-access-application"
                        value={applicationId}
                        onChange={(event) => {
                          setApplicationId(event.target.value);
                          setResults(undefined);
                          setIsUnassignConfirmed(false);
                        }}
                      >
                        <option value="">Elegí una aplicación</option>
                        {applications.map((application) => (
                          <option key={application.id} value={application.id}>
                            {application.name}
                            {application.status === 'ACTIVE' ? '' : ' (inactiva)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p role="alert">{applicationsError}</p>
                  )}
                  <div className="bulk-access-actions">
                    <button
                      className="action-button"
                      type="button"
                      disabled={isSaving || applicationId === '' || applicationsError !== undefined}
                      onClick={() => void runBulkAccessAction('assign')}
                    >
                      Asignar aplicación
                    </button>
                    <label className="bulk-unassign-confirm">
                      <input
                        type="checkbox"
                        checked={isUnassignConfirmed}
                        onChange={(event) => setIsUnassignConfirmed(event.target.checked)}
                      />
                      Confirmo retirar la aplicación y sus perfiles.
                    </label>
                    <button
                      className="text-button"
                      type="button"
                      disabled={isSaving || applicationId === '' || !isUnassignConfirmed}
                      onClick={() => void runBulkAccessAction('unassign')}
                    >
                      Desasignar aplicación
                    </button>
                  </div>
                  <div className="bulk-status-actions">
                    <button
                      className="text-button"
                      type="button"
                      disabled={isSaving}
                      onClick={() => void runBulkStatusAction('activate')}
                    >
                      Activar seleccionados
                    </button>
                    <label className="bulk-unassign-confirm">
                      <input
                        type="checkbox"
                        checked={isDeactivationConfirmed}
                        onChange={(event) => setIsDeactivationConfirmed(event.target.checked)}
                      />
                      Confirmo desactivar los usuarios seleccionados.
                    </label>
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      disabled={isSaving || !isDeactivationConfirmed}
                      onClick={() => void runBulkStatusAction('deactivate')}
                    >
                      Desactivar seleccionados
                    </button>
                  </div>
                  {results === undefined ? null : (
                    <ul className="bulk-result-list" aria-label="Resultado de la operación en lote">
                      {results.map((result) => {
                        const user = state.users.find(
                          (candidate) => candidate.id === result.userId,
                        );
                        return (
                          <li
                            key={result.userId}
                            className={`bulk-result-item bulk-result-item--${result.status.toLowerCase()}`}
                          >
                            {user?.corporateEmail ?? result.userId}:{' '}
                            {result.status === 'ASSIGNED'
                              ? 'asignada'
                              : result.status === 'UNASSIGNED'
                                ? 'desasignada'
                                : result.message}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {statusResults === undefined ? null : (
                    <ul className="bulk-result-list" aria-label="Resultado del cambio de estado">
                      {statusResults.map((result) => (
                        <li
                          key={result.userId}
                          className={`bulk-result-item bulk-result-item--${result.status.toLowerCase()}`}
                        >
                          {result.userId}:{' '}
                          {result.status === 'UPDATED' ? 'estado actualizado' : result.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
              <div className="users-table-wrapper">
                <table>
                  <caption>Usuarios preautorizados</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <input
                          type="checkbox"
                          aria-label="Seleccionar todos los usuarios"
                          checked={selectedUserIds.size === state.users.length}
                          onChange={() => toggleSelectAllUsers(state.users)}
                        />
                      </th>
                      <th scope="col">Usuario</th>
                      <th scope="col">Correo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${user.corporateEmail}`}
                            checked={selectedUserIds.has(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                          />
                        </td>
                        <td>{user.displayName ?? 'Sin nombre visible'}</td>
                        <td>{user.corporateEmail}</td>
                        <td>{user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</td>
                        <td>
                          <a
                            className="text-button"
                            href={`/admin/users/${user.id}`}
                            onClick={(event) => {
                              event.preventDefault();
                              onNavigate(`/admin/users/${user.id}`);
                            }}
                          >
                            Ver y editar
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
