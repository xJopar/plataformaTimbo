import type { EquipmentRentalResponse } from '../../api';
import { Loader } from './loader';
import type { EquipmentRentalsState } from './use-equipment-rentals';

export const EQUIPMENT_RENTAL_CATEGORIES = [
  { label: 'Pala cargadora', matches: ['pala cargadora'] },
  { label: 'Motoniveladora', matches: ['motoniveladora'] },
  { label: 'Excavadora', matches: ['excavadora'] },
  { label: 'Compactador', matches: ['compactador'] },
  {
    label: 'Esparcidora de asfalto',
    matches: ['esparcidora de asfalto', 'espacidora de asfalto'],
  },
  { label: 'Retropala', matches: ['retropala'] },
  { label: 'Bomba de concreto', matches: ['bomba de concreto'] },
] as const;

export interface EquipmentRentalGroup {
  label: string;
  rentals: EquipmentRentalResponse[];
}

function normalizeDescription(description: string): string {
  return description
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-PY');
}

export function groupEquipmentRentals(rentals: EquipmentRentalResponse[]): EquipmentRentalGroup[] {
  const categorized = EQUIPMENT_RENTAL_CATEGORIES.map((category) => ({
    label: category.label,
    rentals: [] as EquipmentRentalResponse[],
  }));
  const uncategorized: EquipmentRentalResponse[] = [];

  for (const rental of rentals) {
    const description = normalizeDescription(rental.description);
    const categoryIndex = EQUIPMENT_RENTAL_CATEGORIES.findIndex((category) =>
      category.matches.some((match) => description.includes(match)),
    );
    if (categoryIndex === -1) {
      uncategorized.push(rental);
      continue;
    }
    categorized[categoryIndex]?.rentals.push(rental);
  }

  return [
    ...categorized.filter((category) => category.rentals.length > 0),
    ...(uncategorized.length > 0 ? [{ label: 'Otros equipos', rentals: uncategorized }] : []),
  ];
}

interface EquipmentRentalsScreenProps {
  state: EquipmentRentalsState;
  onRetry: () => void;
  category?: string;
  onSelectCategory: (category: string) => void;
}

export function EquipmentRentalsScreen({
  state,
  onRetry,
  category,
  onSelectCategory,
}: EquipmentRentalsScreenProps): React.JSX.Element {
  if (state.status === 'loading') {
    return (
      <div className="lp-page lp-equipment-rentals-page">
        <div className="lp-loader-full" role="status" aria-live="polite">
          <Loader />
          <span className="lp-loader-full-label">Cargando tarifas de alquiler...</span>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="lp-page lp-equipment-rentals-page">
        <div className="lp-state-box">
          <span className="lp-state-box-title">Error al cargar tarifas</span>
          <p className="lp-state-box-desc">
            No pudimos obtener las tarifas de alquiler. Intentá nuevamente.
          </p>
          <button className="lp-cta-btn" type="button" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const groups = groupEquipmentRentals(state.rentals);
  if (groups.length === 0) {
    return (
      <div className="lp-page lp-equipment-rentals-page">
        <div className="lp-state-box">
          <span className="lp-state-box-title">Sin tarifas disponibles</span>
          <p className="lp-state-box-desc">No se encontraron equipos de alquiler en el catálogo.</p>
        </div>
      </div>
    );
  }

  if (category === undefined) {
    return (
      <div className="lp-page lp-page--home">
        <div className="lp-brand-grid">
          {groups.map((group) => (
            <button
              className="lp-brand-card"
              key={group.label}
              type="button"
              onClick={() => onSelectCategory(group.label)}
            >
              <span className="lp-brand-card-name">{group.label}</span>
              <span className="lp-brand-card-meta">
                {group.rentals.length} modelo{group.rentals.length !== 1 ? 's' : ''}
              </span>
              <span className="lp-brand-card-count">
                <span className="lp-brand-card-count-link">Ver tarifas</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedGroup = groups.find((group) => group.label === category);
  if (selectedGroup === undefined) {
    return (
      <div className="lp-page lp-equipment-rentals-page">
        <div className="lp-state-box">
          <span className="lp-state-box-title">Categoría no encontrada</span>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-page lp-equipment-rentals-page">
      <div className="lp-equipment-rental-table-wrap">
        <table className="lp-equipment-rental-table">
          <thead>
            <tr>
              <th scope="col">Descripción del equipo</th>
              <th scope="col">Capacidad</th>
              <th scope="col">Tarifa hora</th>
            </tr>
          </thead>
          <tbody>
            {selectedGroup.rentals.map((rental, index) => (
              <tr key={`${rental.description}-${rental.capacity}-${index}`}>
                <td data-label="Equipo">{rental.description || '—'}</td>
                <td data-label="Capacidad">{rental.capacity || '—'}</td>
                <td data-label="Tarifa hora">{rental.tariff || 'A consultar'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
