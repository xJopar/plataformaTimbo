import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ApiHttpError,
  type AdministrativeApplication,
  type AdministrativeApplicationPermission,
  type AdministrativeApplicationProfile,
  type Api,
} from '../api';

interface ProfileFormValues {
  key: string;
  name: string;
  description: string;
}

const EMPTY_PROFILE_FORM: ProfileFormValues = { key: '', name: '', description: '' };

export function ApplicationProfilesPanel({
  api,
  application,
  onClose,
}: {
  api: Api;
  application: AdministrativeApplication;
  onClose: () => void;
}): React.JSX.Element {
  const [profiles, setProfiles] = useState<AdministrativeApplicationProfile[] | undefined>(
    undefined,
  );
  const [permissions, setPermissions] = useState<AdministrativeApplicationPermission[] | undefined>(
    undefined,
  );
  const [form, setForm] = useState<ProfileFormValues>(EMPTY_PROFILE_FORM);
  const [editingProfileId, setEditingProfileId] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const [nextProfiles, nextPermissions] = await Promise.all([
        api.administration.listApplicationProfiles(application.id),
        api.administration.listApplicationPermissions(application.id),
      ]);
      setProfiles(nextProfiles);
      setPermissions(nextPermissions);
    } catch (loadError) {
      setError(
        loadError instanceof ApiHttpError && loadError.status === 403
          ? 'Tu sesión no tiene permiso para gestionar perfiles.'
          : 'No pudimos cargar los perfiles y permisos. Intentá nuevamente.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [api, application.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = (): void => {
    setEditingProfileId(undefined);
    setForm(EMPTY_PROFILE_FORM);
  };

  const save = async (operation: () => Promise<void>): Promise<void> => {
    setIsSaving(true);
    setError(undefined);
    try {
      await operation();
      await load();
    } catch {
      setError('No pudimos guardar los perfiles. Verificá el estado e intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const input = { name: form.name, description: form.description.trim() || null };
    await save(async () => {
      if (editingProfileId === undefined) {
        await api.administration.createApplicationProfile(application.id, {
          key: form.key,
          ...input,
        });
      } else {
        await api.administration.updateApplicationProfile(editingProfileId, input);
      }
      resetForm();
    });
  };

  const beginEditing = (profile: AdministrativeApplicationProfile): void => {
    setEditingProfileId(profile.id);
    setForm({ key: profile.key, name: profile.name, description: profile.description ?? '' });
    setError(undefined);
  };

  const canManageProfiles = application.status === 'ACTIVE';
  return (
    <section className="application-profiles-panel" aria-labelledby={`profiles-${application.id}`}>
      <div className="inline-panel-heading">
        <div>
          <h2 id={`profiles-${application.id}`}>Gestionar perfiles</h2>
          <p>
            {application.name}. Los perfiles funcionales agrupan permisos dentro de esta aplicación.
          </p>
        </div>
        <button className="text-button" type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {!canManageProfiles ? (
        <p className="system-note">
          La aplicación está inactiva; no se pueden crear ni asociar perfiles.
        </p>
      ) : null}
      {error === undefined ? null : (
        <div role="alert">
          <p>{error}</p>
          <button
            className="action-button"
            type="button"
            disabled={isSaving || isLoading}
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      )}
      <form className="profile-form" onSubmit={(event) => void submitProfile(event)}>
        <div className="application-form-heading">
          <h3>
            {editingProfileId === undefined ? 'Crear perfil funcional' : 'Editar perfil funcional'}
          </h3>
          {editingProfileId === undefined ? null : (
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
              disabled={!canManageProfiles || isSaving || editingProfileId !== undefined}
              value={form.key}
              onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
              placeholder="consulta"
            />
          </label>
          <label>
            Nombre
            <input
              required
              disabled={!canManageProfiles || isSaving}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="application-description-field">
            Descripción (opcional)
            <textarea
              rows={2}
              disabled={!canManageProfiles || isSaving}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
        </div>
        <button className="action-button" type="submit" disabled={!canManageProfiles || isSaving}>
          {isSaving
            ? 'Guardando…'
            : editingProfileId === undefined
              ? 'Crear perfil'
              : 'Guardar cambios'}
        </button>
      </form>
      {isLoading ? (
        <p aria-live="polite">Cargando perfiles y permisos…</p>
      ) : profiles === undefined || permissions === undefined ? null : profiles.length === 0 ? (
        <section className="state-surface">
          <h3>No hay perfiles funcionales</h3>
          <p>Creá un perfil y asociá los permisos disponibles en el catálogo de esta aplicación.</p>
        </section>
      ) : (
        <div className="profile-list">
          {profiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              permissions={permissions}
              disabled={!canManageProfiles || isSaving}
              onEdit={() => beginEditing(profile)}
              onChangeStatus={() =>
                save(() =>
                  profile.status === 'ACTIVE'
                    ? api.administration.deactivateApplicationProfile(profile.id)
                    : api.administration.reactivateApplicationProfile(profile.id),
                )
              }
              onAssociatePermission={(permissionId) =>
                save(() =>
                  api.administration.addPermissionToApplicationProfile(profile.id, permissionId),
                )
              }
              onRemovePermission={(permissionId) =>
                save(() =>
                  api.administration.removePermissionFromApplicationProfile(
                    profile.id,
                    permissionId,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
      {permissions !== undefined && permissions.length === 0 ? (
        <section className="state-surface permissions-empty-state">
          <h3>No hay permisos disponibles</h3>
          <p>
            Los permisos pertenecen al catálogo de la aplicación. La API solo permite consultarlos y
            asociarlos a perfiles.
          </p>
        </section>
      ) : null}
    </section>
  );
}

function ProfileRow({
  profile,
  permissions,
  disabled,
  onEdit,
  onChangeStatus,
  onAssociatePermission,
  onRemovePermission,
}: {
  profile: AdministrativeApplicationProfile;
  permissions: AdministrativeApplicationPermission[];
  disabled: boolean;
  onEdit: () => void;
  onChangeStatus: () => Promise<void>;
  onAssociatePermission: (permissionId: string) => Promise<void>;
  onRemovePermission: (permissionId: string) => Promise<void>;
}): React.JSX.Element {
  const associatedPermissionIds = new Set(profile.permissionIds);
  return (
    <section className="profile-row">
      <div className="profile-row-heading">
        <div>
          <h3>{profile.name}</h3>
          <p>{profile.description ?? 'Sin descripción.'}</p>
          <span className="application-key">{profile.key}</span>
        </div>
        <span className={`status-badge status-badge--${profile.status.toLowerCase()}`}>
          {profile.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      <div className="user-actions">
        <button className="text-button" type="button" disabled={disabled} onClick={onEdit}>
          Editar
        </button>
        <button
          className="text-button"
          type="button"
          disabled={disabled}
          onClick={() => void onChangeStatus()}
        >
          {profile.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
        </button>
      </div>
      <div className="permission-list" aria-label={`Permisos de ${profile.name}`}>
        <h4>Permisos del catálogo</h4>
        {permissions.map((permission) => {
          const isAssociated = associatedPermissionIds.has(permission.id);
          const canAssociate = permission.status === 'ACTIVE' && profile.status === 'ACTIVE';
          return (
            <div className="permission-row" key={permission.id}>
              <div>
                <strong>{permission.name}</strong>
                <span>{permission.key}</span>
                {permission.description === null ? null : <span>{permission.description}</span>}
                {permission.status === 'INACTIVE' ? (
                  <span className="inactive-copy">Permiso inactivo</span>
                ) : null}
              </div>
              {isAssociated && profile.status === 'ACTIVE' ? (
                <button
                  className="text-button"
                  type="button"
                  disabled={disabled}
                  onClick={() => void onRemovePermission(permission.id)}
                >
                  Desasociar
                </button>
              ) : isAssociated ? (
                <span className="protected-user-state">Reactivá el perfil para desasociarlo</span>
              ) : canAssociate ? (
                <button
                  className="text-button"
                  type="button"
                  disabled={disabled}
                  onClick={() => void onAssociatePermission(permission.id)}
                >
                  Asociar
                </button>
              ) : (
                <span className="protected-user-state">No asociable</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
