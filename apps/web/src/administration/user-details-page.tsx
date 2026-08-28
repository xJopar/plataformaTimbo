import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons';
import { AccessManagementPanel } from './access-management-panel';
import { ApiHttpError, type AdministrativeUser, type Api } from '../api';
import { reportBrowserOperationFailed } from '../browser-diagnostics';
import { AppIcon } from '../ui/app-icon';

interface UserDetailsPageProps {
  api: Api;
  actorUserId: string;
  userId: string;
  onNavigate: (pathname: string) => void;
}

type UserDetailsState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'error' }
  | { status: 'ready'; user: AdministrativeUser };

export function UserDetailsPage({
  api,
  actorUserId,
  userId,
  onNavigate,
}: UserDetailsPageProps): React.JSX.Element {
  const [state, setState] = useState<UserDetailsState>({ status: 'loading' });
  const [displayName, setDisplayName] = useState('');
  const [isAccessManagementOpen, setIsAccessManagementOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const loadUser = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    setError(undefined);
    try {
      const users = await api.administration.listUsers();
      const user = users.find((candidate) => candidate.id === userId);
      if (user === undefined) {
        setState({ status: 'not-found' });
        return;
      }
      setDisplayName(user.displayName ?? '');
      setState({ status: 'ready', user });
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
  }, [api, userId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const saveDisplayName = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (state.status !== 'ready') return;
    setIsSaving(true);
    setError(undefined);
    try {
      const user = await api.administration.updateUser(state.user.id, {
        displayName: displayName.trim() || null,
      });
      setDisplayName(user.displayName ?? '');
      setState({ status: 'ready', user });
    } catch (operationError) {
      reportBrowserOperationFailed(operationError, {
        operation: 'administration.manage-users',
        method: 'POST',
        route: '/api/admin/users/{userId}',
        provider: 'api',
        ...(operationError instanceof ApiHttpError ? { status: operationError.status } : {}),
      });
      setError('No pudimos guardar el nombre visible. Intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const manageRole = async (action: 'grant' | 'revoke'): Promise<void> => {
    if (state.status !== 'ready') return;
    setIsSaving(true);
    setError(undefined);
    try {
      if (action === 'grant') {
        await api.administration.grantPlatformAdministrator(state.user.id);
      } else {
        await api.administration.revokePlatformAdministrator(state.user.id);
      }
      await loadUser();
    } catch (operationError) {
      reportBrowserOperationFailed(operationError, {
        operation: 'administration.manage-users',
        method: 'POST',
        route:
          action === 'grant'
            ? '/api/admin/users/{userId}/platform-administrator'
            : '/api/admin/users/{userId}/platform-administrator/revoke',
        provider: 'api',
        ...(operationError instanceof ApiHttpError ? { status: operationError.status } : {}),
      });
      setError(
        operationError instanceof ApiHttpError && operationError.status === 409
          ? action === 'grant'
            ? 'Solo una persona activa puede convertirse en administradora.'
            : 'No se puede revocar este rol: no podés revocarte ni dejar la plataforma sin administrador.'
          : 'No pudimos actualizar el rol de plataforma. Intentá nuevamente.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const changeStatus = async (): Promise<void> => {
    if (state.status !== 'ready') return;
    setIsSaving(true);
    setError(undefined);
    try {
      if (state.user.status === 'ACTIVE') {
        await api.administration.deactivateUser(state.user.id);
      } else {
        await api.administration.reactivateUser(state.user.id);
      }
      await loadUser();
    } catch (operationError) {
      reportBrowserOperationFailed(operationError, {
        operation: 'administration.manage-users',
        method: 'POST',
        route:
          state.user.status === 'ACTIVE'
            ? '/api/admin/users/{userId}/deactivate'
            : '/api/admin/users/{userId}/reactivate',
        provider: 'api',
        ...(operationError instanceof ApiHttpError ? { status: operationError.status } : {}),
      });
      setError(
        operationError instanceof ApiHttpError && operationError.status === 409
          ? 'Primero se debe revocar el rol de administrador de plataforma.'
          : 'No pudimos actualizar el estado del usuario. Intentá nuevamente.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="administration-content" aria-labelledby="user-details-title">
      <a
        className="text-link administration-back-link"
        href="/admin"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('/admin');
        }}
      >
        <AppIcon icon={ArrowLeft02Icon} size={18} strokeWidth={2.4} />
        <span>Volver a usuarios</span>
      </a>
      {state.status === 'loading' ? <p aria-live="polite">Cargando usuario…</p> : null}
      {state.status === 'forbidden' ? (
        <section className="state-surface" aria-labelledby="user-forbidden-title">
          <h1 id="user-forbidden-title">No tenés permiso para ver este usuario</h1>
          <p>Solicitá a un administrador de plataforma que revise tu asignación.</p>
        </section>
      ) : null}
      {state.status === 'not-found' ? (
        <section className="state-surface" aria-labelledby="user-not-found-title">
          <h1 id="user-not-found-title">No encontramos este usuario</h1>
          <p>Puede haber sido retirado de la lista o el enlace ya no es válido.</p>
        </section>
      ) : null}
      {state.status === 'error' ? (
        <section className="state-surface" aria-labelledby="user-error-title">
          <h1 id="user-error-title">No pudimos cargar este usuario</h1>
          <p>La información no está disponible en este momento.</p>
          <button className="action-button" type="button" onClick={() => void loadUser()}>
            Reintentar
          </button>
        </section>
      ) : null}
      {state.status !== 'ready' ? null : (
        <>
          <h1 id="user-details-title">{state.user.displayName ?? state.user.corporateEmail}</h1>
          <p className="administration-description">{state.user.corporateEmail}</p>
          <section
            className="state-surface user-profile-panel"
            aria-labelledby="user-profile-title"
          >
            <div className="user-profile-panel-heading">
              <div>
                <h2 id="user-profile-title">Información de la persona</h2>
                <p>Actualizá el nombre visible o gestioná el rol y el estado de esta cuenta.</p>
              </div>
              <dl className="user-account-facts">
                <div>
                  <dt>Estado</dt>
                  <dd className={`status-badge status-badge--${state.user.status.toLowerCase()}`}>
                    {state.user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </dd>
                </div>
                <div>
                  <dt>Rol</dt>
                  <dd>
                    {state.user.isPlatformAdministrator
                      ? 'Administrador de plataforma'
                      : 'Usuario de plataforma'}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="user-profile-panel-body">
              <form
                className="identity-edit-form"
                onSubmit={(event) => void saveDisplayName(event)}
              >
                <label htmlFor="display-name">Nombre visible</label>
                <p className="field-hint">
                  Usá un nombre distinto sólo si la presentación debe diferir del perfil de Google.
                </p>
                <input
                  id="display-name"
                  disabled={isSaving}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
                <button className="action-button" type="submit" disabled={isSaving}>
                  Guardar nombre
                </button>
              </form>
              <div className="user-governance-actions" aria-label="Acciones de la cuenta">
                {state.user.isPlatformAdministrator ? (
                  actorUserId === state.user.id ? (
                    <p className="field-hint">No podés revocar tu propio rol administrativo.</p>
                  ) : (
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      disabled={isSaving}
                      onClick={() => void manageRole('revoke')}
                    >
                      Revocar administración
                    </button>
                  )
                ) : (
                  <button
                    className="text-button"
                    type="button"
                    disabled={isSaving || state.user.status !== 'ACTIVE'}
                    onClick={() => void manageRole('grant')}
                  >
                    Convertir en administrador
                  </button>
                )}
                <button
                  className={
                    state.user.status === 'ACTIVE'
                      ? 'text-button text-button--danger'
                      : 'action-button'
                  }
                  type="button"
                  disabled={isSaving || state.user.isPlatformAdministrator}
                  onClick={() => void changeStatus()}
                >
                  {state.user.status === 'ACTIVE' ? 'Desactivar usuario' : 'Reactivar usuario'}
                </button>
              </div>
            </div>
            {error === undefined ? null : <p role="alert">{error}</p>}
          </section>
          <section className="access-management-entry" aria-labelledby="access-entry-title">
            <div>
              <h2 id="access-entry-title">Accesos a aplicaciones</h2>
              <p>Asigná aplicaciones y administrá sus perfiles funcionales cuando sea necesario.</p>
            </div>
            <button
              className="action-button"
              type="button"
              aria-controls={`access-management-panel-${state.user.id}`}
              aria-expanded={isAccessManagementOpen}
              onClick={() => setIsAccessManagementOpen((current) => !current)}
            >
              {isAccessManagementOpen ? 'Ocultar accesos' : 'Gestionar aplicaciones y perfiles'}
            </button>
          </section>
          {isAccessManagementOpen ? (
            <AccessManagementPanel
              api={api}
              user={state.user}
              onClose={() => setIsAccessManagementOpen(false)}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
