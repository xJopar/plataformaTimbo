import { useState } from 'react';
import type { Empresa } from './meta-company-types';

interface EmpresaFormValues {
  code: string;
  name: string;
}

const EMPTY_FORM: EmpresaFormValues = { code: '', name: '' };

interface EmpresaManagementScreenProps {
  empresas: Empresa[];
  action: string | undefined;
  onSave: (input: EmpresaFormValues, editingId: number | undefined) => Promise<void>;
  onToggle: (empresa: Empresa) => Promise<void>;
}

export function EmpresaManagementScreen({
  empresas,
  action,
  onSave,
  onToggle,
}: EmpresaManagementScreenProps): React.JSX.Element {
  const [form, setForm] = useState<EmpresaFormValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number>();

  const updateForm = (field: keyof EmpresaFormValues, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = (): void => {
    setEditingId(undefined);
    setForm(EMPTY_FORM);
  };

  const beginEditing = (empresa: Empresa): void => {
    setEditingId(empresa.id);
    setForm({ code: empresa.code, name: empresa.name });
  };

  const isSaving =
    action === 'empresa-create' || (editingId !== undefined && action === `empresa-edit-${editingId}`);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    try {
      await onSave(form, editingId);
      resetForm();
    } catch {
      // el error ya se reporta en el estado compartido de la página
    }
  };

  return (
    <section aria-labelledby="mc-empresa-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-empresa-title">Empresas</h2>
          <p>Las empresas inactivas se conservan para no alterar el histórico de Power BI.</p>
        </div>
      </div>
      <form className="mc-manage-form" onSubmit={(event) => void submit(event)}>
        <div className="mc-workbench-heading">
          <h3>{editingId === undefined ? 'Nueva empresa' : 'Editar empresa'}</h3>
          {editingId === undefined ? null : (
            <button type="button" className="mc-text-action" onClick={resetForm}>
              Cancelar edición
            </button>
          )}
        </div>
        <div className="mc-manage-form-grid">
          <label>
            Código
            <input
              required
              placeholder="TIMBO"
              value={form.code}
              onChange={(event) => updateForm('code', event.target.value)}
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
        </div>
        <button className="mc-primary-action" disabled={isSaving}>
          {isSaving ? 'Guardando…' : editingId === undefined ? 'Agregar empresa' : 'Guardar cambios'}
        </button>
      </form>
      <div className="mc-manage-table-wrapper">
        <table className="mc-manage-table">
          <caption>Empresas registradas</caption>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Nombre</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <tr key={empresa.id}>
                <td>
                  <code>{empresa.code}</code>
                </td>
                <td>{empresa.name}</td>
                <td>{empresa.active ? 'Activo' : 'Inactivo'}</td>
                <td className="mc-manage-actions">
                  <button
                    type="button"
                    className="mc-text-action"
                    disabled={isSaving}
                    onClick={() => beginEditing(empresa)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="mc-text-action"
                    disabled={action === `empresa-${empresa.id}`}
                    onClick={() => void onToggle(empresa)}
                  >
                    {empresa.active ? 'Desactivar' : 'Reactivar'}
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
