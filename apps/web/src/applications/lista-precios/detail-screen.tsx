import { useEffect, useState } from 'react';
import type { AuthorizedApplication, VehicleResponse } from '../../api';
import {
  CALCULADORA_CUOTAS_LAUNCH_PATH,
  buildFromStockPath,
} from '../calculadora-cuotas/calculadora-cuotas-routes';
import { formatPrice, parsePrice } from '../../vehicle-catalog/vehicle-catalog';
import { Loader } from './loader';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';

/** Piso/Altura son campos propios de semirremolques (Facchini, Librelato). */
const SEMIRREMOLQUE_BRANDS = ['FACCHINI', 'LIBRELATO'];

interface DetailScreenProps {
  modelKey: string;
  vehiclesState: VehicleCatalogState;
  availableApplications: readonly AuthorizedApplication[];
  whatsAppNumber: string;
  whatsAppMessageTemplate: string;
  onConsultationStarted: () => void;
  onNavigate: (pathname: string) => void;
}

function InfoRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string | undefined;
  mono?: boolean;
  highlight?: boolean;
}): React.JSX.Element | null {
  if (!value) return null;
  return (
    <div className={`lp-detail-row${highlight ? ' lp-detail-row--highlight' : ''}`}>
      <span className="lp-detail-row-label">{label}</span>
      <span className={`lp-detail-row-value${mono ? ' lp-detail-row-value--mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function AvailBadge({ disponible }: { disponible: string }): React.JSX.Element {
  const isAvailable = disponible.toUpperCase() === 'SI';
  return (
    <span className={`lp-avail-badge lp-avail-badge--${isAvailable ? 'yes' : 'no'}`}>
      {isAvailable ? 'Disponible' : 'No disponible'}
    </span>
  );
}

function StockUnit({
  unit,
  selected,
  onSelect,
}: {
  unit: VehicleResponse;
  selected: boolean;
  onSelect: (unit: VehicleResponse | null) => void;
}): React.JSX.Element {
  const precio = parsePrice(unit.precioLista);
  const metaParts = [
    unit.color,
    unit.tipoCaja,
    unit.aire === 'SI' ? 'Con A/C' : unit.aire === 'NO' ? 'Sin A/C' : null,
    unit.ubicacion,
    precio !== null ? formatPrice(precio) : null,
    unit.km ? `${Number(unit.km).toLocaleString('es-PY')} km` : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className={`lp-stock-unit${selected ? ' lp-stock-unit--selected' : ''}`}
      aria-pressed={selected}
      onClick={() => onSelect(selected ? null : unit)}
    >
      <span className="lp-stock-unit-head">
        <span className="lp-stock-unit-code">{unit.stock}</span>
        <AvailBadge disponible={unit.disponible} />
      </span>

      {metaParts.length > 0 ? (
        <span className="lp-stock-unit-meta">{metaParts.join(' · ')}</span>
      ) : null}
      {unit.origen ? <span className="lp-stock-unit-origin">{unit.origen}</span> : null}
      {unit.comentario && unit.comentario !== unit.origen ? (
        <span className="lp-stock-unit-origin">{unit.comentario}</span>
      ) : null}
    </button>
  );
}

export function DetailScreen({
  modelKey,
  vehiclesState,
  availableApplications,
  whatsAppNumber,
  whatsAppMessageTemplate,
  onConsultationStarted,
  onNavigate,
}: DetailScreenProps): React.JSX.Element {
  const [selectedUnit, setSelectedUnit] = useState<VehicleResponse | null>(null);
  const group = vehiclesState.status === 'ready' ? vehiclesState.groups.get(modelKey) : undefined;
  const canCalculateInstallments = availableApplications.some(
    (application) => application.launchPath === CALCULADORA_CUOTAS_LAUNCH_PATH,
  );

  useEffect(() => {
    if (selectedUnit !== null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedUnit]);

  if (vehiclesState.status === 'loading') {
    return (
      <div className="lp-detail-page">
        <div className="lp-loader-full" role="status" aria-live="polite">
          <Loader />
          <span className="lp-loader-full-label">Cargando lista de precios...</span>
        </div>
      </div>
    );
  }

  if (vehiclesState.status === 'error') {
    return (
      <div className="lp-detail-page">
        <div className="lp-state-box">
          <span className="lp-state-box-title">Error al cargar datos</span>
        </div>
      </div>
    );
  }

  if (group === undefined) {
    return (
      <div className="lp-detail-page">
        <div className="lp-state-box">
          <span className="lp-state-box-title">Modelo no encontrado</span>
        </div>
      </div>
    );
  }

  const anioLabel =
    group.anios.length === 1
      ? group.anios[0]
      : `${group.anios[0]} - ${group.anios[group.anios.length - 1]}`;
  const groupPriceLabel =
    group.precioMin === null
      ? null
      : group.precioMin === group.precioMax
        ? formatPrice(group.precioMin)
        : `${formatPrice(group.precioMin)} - ${formatPrice(group.precioMax)}`;

  const unitPrice = selectedUnit === null ? null : parsePrice(selectedUnit.precioLista);
  const isSemirremolque = SEMIRREMOLQUE_BRANDS.includes(group.marca.trim().toUpperCase());

  function buildWhatsAppUrl(): string {
    const modeloStr =
      selectedUnit !== null
        ? `${group?.name} - Stock ${selectedUnit.stock}`
        : `${group?.name} (${group?.anios[group.anios.length - 1]})`;
    const text = whatsAppMessageTemplate.replace('{modelo}', modeloStr);
    return `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="lp-detail-page lp-detail-page--has-cta">
      <div className="lp-detail-page-grid">
        <div className="lp-detail-page-left">
          <div
            key={selectedUnit?.stock ?? 'group'}
            className="lp-detail-section lp-detail-panel-anim"
          >
            {selectedUnit === null ? (
              <>
                <InfoRow label="Nombre" value={group.name} />
                <InfoRow label="Tipo" value={group.tipo} />
                <InfoRow label="Año Fab." value={anioLabel} />
                <InfoRow label="Config." value={group.config} />
                <InfoRow label="Motor" value={group.tipoMotor} />
                <InfoRow label="Susp." value={group.susp} />
                {groupPriceLabel !== null ? (
                  <InfoRow label="Precio" value={groupPriceLabel} mono />
                ) : null}
                <p className="lp-detail-hint">Tocá una unidad para ver su detalle</p>
              </>
            ) : (
              <>
                <div className="lp-detail-unit-head">
                  <span className="lp-detail-unit-code">{selectedUnit.stock}</span>
                  <AvailBadge disponible={selectedUnit.disponible} />
                </div>

                <div className="lp-shared-info-card">
                  <div className="lp-shared-info-card-grid">
                    {group.name ? (
                      <div className="lp-shared-info-card-cell lp-shared-info-card-cell--full">
                        <span className="lp-shared-info-card-lbl">Nombre</span>
                        <span className="lp-shared-info-card-val">{group.name}</span>
                      </div>
                    ) : null}
                    {group.tipo || selectedUnit.tipoUnidad ? (
                      <div className="lp-shared-info-card-cell">
                        <span className="lp-shared-info-card-lbl">Tipo</span>
                        <span className="lp-shared-info-card-val">
                          {group.tipo || selectedUnit.tipoUnidad}
                        </span>
                      </div>
                    ) : null}
                    {selectedUnit.anioFab ? (
                      <div className="lp-shared-info-card-cell">
                        <span className="lp-shared-info-card-lbl">Año Fab.</span>
                        <span className="lp-shared-info-card-val">{selectedUnit.anioFab}</span>
                      </div>
                    ) : null}
                    {group.tipoMotor ? (
                      <div className="lp-shared-info-card-cell">
                        <span className="lp-shared-info-card-lbl">Motor</span>
                        <span className="lp-shared-info-card-val">{group.tipoMotor}</span>
                      </div>
                    ) : null}
                    {group.susp ? (
                      <div className="lp-shared-info-card-cell">
                        <span className="lp-shared-info-card-lbl">Susp.</span>
                        <span className="lp-shared-info-card-val">{group.susp}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {unitPrice !== null ? (
                  <div className="lp-price-band">
                    <span className="lp-price-band-lbl">Precio lista</span>
                    <span className="lp-price-band-val">{formatPrice(unitPrice)}</span>
                  </div>
                ) : null}

                {unitPrice !== null && canCalculateInstallments ? (
                  <button
                    type="button"
                    className="lp-installment-link"
                    onClick={() =>
                      onNavigate(
                        buildFromStockPath(CALCULADORA_CUOTAS_LAUNCH_PATH, selectedUnit.stock),
                      )
                    }
                  >
                    Calcular cuota para esta unidad
                  </button>
                ) : null}

                <div className="lp-unit-fields-section">
                  <InfoRow label="Color" value={selectedUnit.color} />
                  {selectedUnit.comentario && selectedUnit.comentario !== selectedUnit.origen ? (
                    <InfoRow label="Comentario" value={selectedUnit.comentario} highlight />
                  ) : null}
                  <InfoRow label="Tipo Caja" value={selectedUnit.tipoCaja} />
                  <InfoRow
                    label="Aire"
                    value={
                      selectedUnit.aire === 'SI'
                        ? 'Si'
                        : selectedUnit.aire === 'NO'
                          ? 'No'
                          : selectedUnit.aire
                    }
                  />
                  <InfoRow
                    label="KM"
                    value={
                      selectedUnit.km
                        ? `${Number(selectedUnit.km).toLocaleString('es-PY')} km`
                        : undefined
                    }
                  />
                  <InfoRow label="Ubicacion" value={selectedUnit.ubicacion} />
                  <InfoRow label="Origen" value={selectedUnit.origen} />
                  {isSemirremolque ? <InfoRow label="Piso" value={selectedUnit.piso} /> : null}
                  {isSemirremolque ? <InfoRow label="Altura" value={selectedUnit.altura} /> : null}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lp-detail-page-right">
          <div className="lp-stock-section-header">
            <span className="lp-stock-section-label">
              {selectedUnit !== null ? 'Unidad seleccionada' : 'Unidades disponibles'}
            </span>
            <span className="lp-stock-badge">
              {group.stockCount} {group.stockCount !== 1 ? 'unidades' : 'unidad'}
            </span>
          </div>

          <div className="lp-stock-list">
            {group.units.map((unit) => (
              <StockUnit
                key={unit.stock}
                unit={unit}
                selected={selectedUnit?.stock === unit.stock}
                onSelect={setSelectedUnit}
              />
            ))}
          </div>

          <button
            className="lp-cta-btn lp-cta-btn--fixed"
            type="button"
            onClick={() => {
              onConsultationStarted();
              window.open(buildWhatsAppUrl(), '_blank', 'noopener,noreferrer');
            }}
          >
            {selectedUnit !== null
              ? `Consultar stock ${selectedUnit.stock}`
              : 'Consultar disponibilidad'}
          </button>
        </div>
      </div>
    </div>
  );
}
