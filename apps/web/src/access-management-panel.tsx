import { useCallback, useEffect, useState } from 'react';
import {
  ApiHttpError,
  type AdministrativeApplication,
  type AdministrativeApplicationProfile,
  type AdministrativeUser,
  type AdministrativeUserApplicationAccess,
  type Api,
} from './api';

interface AccessManagementPanelProps {
  api: Api;
  user: AdministrativeUser;
  onClose: () => void;
}

interface AccessManagementData {
  applications: AdministrativeApplication[];
  accesses: AdministrativeUserApplicationAccess[];
  profilesByApplicationId: Record<string, AdministrativeApplicationProfile[]>;
}

export function AccessManagementPanel({
  api,
  user,
  onClose,
}: AccessManagementPanelProps): React.JSX.Element {
  const [data, setData] = useState<AccessManagementData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [applicationToUnassign, setApplicationToUnassign] = useState<string | undefined>(undefined);
  const [isUnassignmentConfirmed, setIsUnassignmentConfirmed] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [applications, accesses] = await Promise.all([
        api.administration.listApplications(),
        api.administration.listUserApplicationAccesses(user.id),
      ]);
      const profiles = await Promise.all(
        accesses.map(
          async (access) =>
            [
              access.applicationId,
              await api.administration.listApplicationProfiles(access.applicationId),
            ] as const,
        ),
      );
      setData({
        applications,
        accesses,
        profilesByApplicationId: Object.fromEntries(profiles),
      });
    } catch (loadError) {
      setError(
        loadError instanceof ApiHttpError && loadError.status === 403
          ? 'Tu sesión no tiene permiso para gestionar estos accesos.'
          : 'No pudimos cargar las asignaciones. Intentá nuevamente.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [api, user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (operation: () => Promise<void>): Promise<void> => {
    setIsSaving(true);
    setError(undefined);
    try {
      await operation();
      setApplicationToUnassign(undefined);
      setIsUnassignmentConfirmed(false);
      await load();
    } catch {
      setError('No pudimos guardar el acceso. Verificá el estado e intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const isUserActive = user.status === 'ACTIVE';
  const accessByApplicationId = new Map(
    data?.accesses.map((access) => [access.applicationId, access]),
  );

  return (
    <section className="access-management-panel" aria-labelledby={`access-management-${user.id}`}>
      <div className="inline-panel-heading">
        <div>
          <h2 id={`access-management-${user.id}`}>Gestionar accesos</h2>
          <p>
            {user.displayName ?? user.corporateEmail}. La aplicación permite verla y entrar; los
            perfiles definen qué puede hacer dentro.
          </p>
        </div>
        <button className="text-button" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {user.isPlatformAdministrator ? (
        <p className="system-note">
          PLATFORM_ADMIN es un perfil de sistema: no concede acceso funcional a aplicaciones.
        </p>
      ) : null}
      {!isUserActive ? (
        <p className="system-note">El usuario está inactivo; no se pueden crear asignaciones.</p>
      ) : null}
      {isLoading ? <p aria-live="polite">Cargando asignaciones…</p> : null}
      {error === undefined ? null : (
        <div role="alert">
          <p>{error}</p>
          <button
            className="action-button"
            type="button"
            disabled={isLoading}
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      )}
      {data === undefined ? null : (
        <div className="access-management-list">
          {data.applications.length === 0 ? (
            <section className="state-surface">
              <h3>No hay aplicaciones para asignar</h3>
              <p>Primero registrá una aplicación en el catálogo administrativo.</p>
            </section>
          ) : (
            data.applications.map((application) => {
              const access = accessByApplicationId.get(application.id);
              const isAssigned = access !== undefined;
              const profiles = data.profilesByApplicationId[application.id] ?? [];
              return (
                <section className="access-application-row" key={application.id}>
                  <div className="access-application-summary">
                    <div>
                      <h3>{application.name}</h3>
                      <p>
                        {application.status === 'ACTIVE'
                          ? isAssigned
                            ? 'Aplicación asignada.'
                            : 'Aplicación disponible para asignar.'
                          : 'Aplicación inactiva; no admite nuevas asignaciones.'}
                      </p>
                    </div>
                    <span
                      className={`status-badge status-badge--${application.status.toLowerCase()}`}
                    >
                      {application.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  {!isAssigned && application.status === 'ACTIVE' ? (
                    <button
                      className="action-button"
                      type="button"
                      disabled={isSaving || !isUserActive}
                      onClick={() =>
                        void save(() =>
                          api.administration.assignApplicationToUser(user.id, application.id),
                        )
                      }
                    >
                      Asignar aplicación
                    </button>
                  ) : null}
                  {isAssigned ? (
                    <>
                      {applicationToUnassign === application.id ? (
                        <div className="unassignment-confirmation">
                          <p id={`unassign-warning-${application.id}`}>
                            Desasignar esta aplicación también retira todos sus perfiles
                            funcionales.
                          </p>
                          <label>
                            <input
                              type="checkbox"
                              checked={isUnassignmentConfirmed}
                              onChange={(event) => setIsUnassignmentConfirmed(event.target.checked)}
                            />
                            Confirmo que deseo retirar la aplicación y sus perfiles.
                          </label>
                          <div className="user-actions">
                            <button
                              className="action-button"
                              type="button"
                              aria-describedby={`unassign-warning-${application.id}`}
                              disabled={isSaving || !isUnassignmentConfirmed}
                              onClick={() =>
                                void save(() =>
                                  api.administration.unassignApplicationFromUser(
                                    user.id,
                                    application.id,
                                  ),
                                )
                              }
                            >
                              Confirmar desasignación
                            </button>
                            <button
                              className="text-button"
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setApplicationToUnassign(undefined);
                                setIsUnassignmentConfirmed(false);
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="text-button"
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            setApplicationToUnassign(application.id);
                            setIsUnassignmentConfirmed(false);
                          }}
                        >
                          Desasignar aplicación
                        </button>
                      )}
                      <ProfileAssignments
                        applicationId={application.id}
                        profiles={profiles}
                        assignedProfileIds={access.profileIds}
                        disabled={isSaving || !isUserActive || application.status !== 'ACTIVE'}
                        onAssign={(profileId) =>
                          save(() =>
                            api.administration.assignApplicationProfileToUser(user.id, profileId),
                          )
                        }
                        onUnassign={(profileId) =>
                          save(() =>
                            api.administration.unassignApplicationProfileFromUser(
                              user.id,
                              profileId,
                            ),
                          )
                        }
                      />
                    </>
                  ) : null}
                </section>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function ProfileAssignments({
  applicationId,
  profiles,
  assignedProfileIds,
  disabled,
  onAssign,
  onUnassign,
}: {
  applicationId: string;
  profiles: AdministrativeApplicationProfile[];
  assignedProfileIds: string[];
  disabled: boolean;
  onAssign: (profileId: string) => Promise<void>;
  onUnassign: (profileId: string) => Promise<void>;
}): React.JSX.Element {
  const assignedProfileIdSet = new Set(assignedProfileIds);
  return (
    <div
      className="profile-assignment-list"
      aria-labelledby={`profile-assignments-${applicationId}`}
    >
      <h4 id={`profile-assignments-${applicationId}`}>Perfiles funcionales</h4>
      {profiles.length === 0 ? (
        <p>No hay perfiles funcionales configurados para esta aplicación.</p>
      ) : (
        profiles.map((profile) => {
          const isAssigned = assignedProfileIdSet.has(profile.id);
          const canAssign = profile.status === 'ACTIVE' && !isAssigned;
          return (
            <div className="profile-assignment-row" key={profile.id}>
              <div>
                <strong>{profile.name}</strong>
                <span>{profile.key}</span>
                {profile.status === 'INACTIVE' ? (
                  <span className="inactive-copy">Perfil inactivo</span>
                ) : null}
              </div>
              {isAssigned ? (
                <button
                  className="text-button"
                  type="button"
                  disabled={disabled}
                  onClick={() => void onUnassign(profile.id)}
                >
                  Desasociar
                </button>
              ) : canAssign ? (
                <button
                  className="text-button"
                  type="button"
                  disabled={disabled}
                  onClick={() => void onAssign(profile.id)}
                >
                  Asociar
                </button>
              ) : (
                <span className="protected-user-state">No asignable</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
