import { useState } from 'react';
import type { CatalogItem, Empresa } from './meta-company-types';

export type CatalogItemKind = 'brand' | 'business';

interface CatalogItemFormValues {
  empresaId: string;
  name: string;
}

const EMPTY_FORM: CatalogItemFormValues = { empresaId: '', name: '' };

interface CatalogItemManagementScreenProps {
  kind: CatalogItemKind;
  title: string;
  items: CatalogItem[];
  empresas: Empresa[];
  action: string | undefined;
  onSave: (
    input: { empresaId: number; name: string },
    editingId: number | undefined,
  ) => Promise<void>;
  onToggle: (item: CatalogItem) => Promise<void>;
}

export function CatalogItemManagementScreen({
  kind,
  title,
  items,
  empresas,
  action,
  onSave,
  onToggle,
}: CatalogItemManagementScreenProps): React.JSX.Element {
  const [form, setForm] = useState<CatalogItemFormValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number>();

  const updateForm = (field: keyof CatalogItemFormValues, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = (): void => {
    setEditingId(undefined);
    setForm(EMPTY_FORM);
  };

  const beginEditing = (item: CatalogItem): void => {
    setEditingId(item.id);
    setForm({ empresaId: String(item.empresaId), name: item.name });
  };

  const isSaving =
    action === `${kind}-create` || (editingId !== undefined && action === `${kind}-edit-${editingId}`);

  const singularLabel = kind === 'brand' ? 'marca' : 'negocio';

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    try {
      await onSave({ empresaId: Number(form.empresaId), name: form.name }, editingId);
      resetForm();
    } catch {
      // el error ya se reporta en el estado compartido de la página
    }
  };

  return (
    <section aria-labelledby={`mc-${kind}-title`}>
      <div className="mc-workbench-heading">
        <div>
          <h2 id={`mc-${kind}-title`}>{title}</h2>
          <p>
            {kind === 'brand'
              ? 'Las marcas inactivas se conservan para no alterar el histórico de Power BI.'
              : 'Los negocios inactivos se conservan para no alterar el histórico de Power BI.'}
          </p>
        </div>
      </div>
      <form className="mc-manage-form" onSubmit={(event) => void submit(event)}>
        <div className="mc-workbench-heading">
          <h3>{editingId === undefined ? `Nueva ${singularLabel}` : `Editar ${singularLabel}`}</h3>
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
            Nombre
            <input
              required
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
            />
          </label>
        </div>
        <button className="mc-primary-action" disabled={isSaving}>
          {isSaving ? 'Guardando…' : editingId === undefined ? `Agregar ${singularLabel}` : 'Guardar cambios'}
        </button>
      </form>
      <div className="mc-manage-table-wrapper">
        <table className="mc-manage-table">
          <caption>{title} registrados</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Empresa</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{empresas.find((empresa) => empresa.id === item.empresaId)?.name ?? '—'}</td>
                <td>{item.active ? 'Activo' : 'Inactivo'}</td>
                <td className="mc-manage-actions">
                  <button
                    type="button"
                    className="mc-text-action"
                    disabled={isSaving}
                    onClick={() => beginEditing(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="mc-text-action"
                    disabled={action === `${kind}-${item.id}`}
                    onClick={() => void onToggle(item)}
                  >
                    {item.active ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
