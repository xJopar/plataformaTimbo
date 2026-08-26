import type { ListaPreciosVehiclesState } from './use-lista-precios-vehicles';
import { Loader } from './loader';

interface HomeScreenProps {
  vehiclesState: ListaPreciosVehiclesState;
  onRetry: () => void;
  onSelectBrand: (brand: string) => void;
}

export function HomeScreen({
  vehiclesState,
  onRetry,
  onSelectBrand,
}: HomeScreenProps): React.JSX.Element {
  return (
    <div className="lp-page lp-page--home">
      {vehiclesState.status === 'loading' ? (
        <div className="lp-loader-full" role="status" aria-live="polite">
          <Loader />
          <span className="lp-loader-full-label">Cargando lista de precios...</span>
        </div>
      ) : null}

      {vehiclesState.status === 'error' ? (
        <div className="lp-state-box">
          <span className="lp-state-box-title">Error al cargar datos</span>
          <p className="lp-state-box-desc">
            No pudimos obtener el catálogo de vehículos. Intentá nuevamente.
          </p>
          <button className="lp-cta-btn" type="button" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : null}

      {vehiclesState.status === 'ready' && vehiclesState.brands.length === 0 ? (
        <div className="lp-state-box">
          <span className="lp-state-box-title">Sin datos</span>
          <p className="lp-state-box-desc">No se encontraron unidades en el catálogo.</p>
        </div>
      ) : null}

      {vehiclesState.status === 'ready' && vehiclesState.brands.length > 0 ? (
        <div className="lp-brand-grid">
          {vehiclesState.brands.map((brand) => (
            <button
              type="button"
              key={brand.marca}
              className={`lp-brand-card${brand.isOtros ? ' lp-brand-card--full' : ''}`}
              onClick={() => onSelectBrand(brand.marca)}
            >
              <span className="lp-brand-card-name">{brand.marca}</span>
              <span className="lp-brand-card-meta">
                {brand.modelCount} modelo{brand.modelCount !== 1 ? 's' : ''}
              </span>
              <span className="lp-brand-card-count">
                <span className="lp-brand-card-count-badge">
                  {brand.unitCount} {brand.unitCount !== 1 ? 'unidades' : 'unidad'}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
