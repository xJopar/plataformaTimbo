import { useEffect, useRef } from 'react';
import type { VehicleFilters } from './data-processor';

export interface ListaPreciosFilterOptions {
  config: string[];
  susp: string[];
  tipoMotor: string[];
  tipoCaja: string[];
  color: string[];
  ubicacion: string[];
  aire: string[];
  anioFab: string[];
}

const FILTER_GROUPS: { field: keyof VehicleFilters; label: string }[] = [
  { field: 'config', label: 'Configuración' },
  { field: 'susp', label: 'Suspensión' },
  { field: 'tipoMotor', label: 'Tipo de Motor' },
  { field: 'tipoCaja', label: 'Tipo de Caja' },
  { field: 'color', label: 'Color' },
  { field: 'ubicacion', label: 'Ubicación' },
  { field: 'aire', label: 'Aire' },
  { field: 'anioFab', label: 'Año' },
];

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: VehicleFilters;
  onChange: (field: keyof VehicleFilters, value: string) => void;
  onClear: () => void;
  options: ListaPreciosFilterOptions;
  disabledOptions: Record<keyof VehicleFilters, Record<string, boolean>>;
}

/** Umbral, en píxeles, de swipe hacia abajo para cerrar el drawer con un gesto táctil. */
const SWIPE_TO_CLOSE_THRESHOLD_PX = 60;

export function FilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  onClear,
  options,
  disabledOptions,
}: FilterDrawerProps): React.JSX.Element {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const drawer = drawerRef.current;
    if (drawer === null) return undefined;

    let startY = 0;
    const onTouchStart = (event: TouchEvent): void => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchEnd = (event: TouchEvent): void => {
      const endY = event.changedTouches[0]?.clientY ?? startY;
      if (endY - startY > SWIPE_TO_CLOSE_THRESHOLD_PX) onClose();
    };

    drawer.addEventListener('touchstart', onTouchStart, { passive: true });
    drawer.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      drawer.removeEventListener('touchstart', onTouchStart);
      drawer.removeEventListener('touchend', onTouchEnd);
    };
  }, [open, onClose]);

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <>
      <div
        className={`lp-drawer-overlay${open ? ' lp-drawer-overlay--visible' : ''}`}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        className={`lp-drawer${open ? ' lp-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
      >
        <div className="lp-drawer-handle" aria-hidden="true" />

        <div className="lp-drawer-header">
          <span className="lp-drawer-title">
            Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
          </span>
          <button className="lp-drawer-clear" type="button" onClick={onClear}>
            Limpiar
          </button>
        </div>

        <div className="lp-drawer-body">
          {FILTER_GROUPS.map(({ field, label }) => {
            const groupOptions = options[field];
            if (groupOptions.length === 0) return null;
            return (
              <div key={field}>
                <div className="lp-filter-group-label">{label}</div>
                <div className="lp-filter-chips">
                  {groupOptions.map((option) => {
                    const isActive = filters[field] === option;
                    const isDisabled = !isActive && disabledOptions[field]?.[option] === true;
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`lp-filter-chip${isActive ? ' lp-filter-chip--active' : ''}${
                          isDisabled ? ' lp-filter-chip--disabled' : ''
                        }`}
                        disabled={isDisabled}
                        onClick={() => onChange(field, isActive ? '' : option)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="lp-drawer-apply">
          <button className="lp-cta-btn" type="button" onClick={onClose}>
            Ver resultados
          </button>
        </div>
      </div>
    </>
  );
}
