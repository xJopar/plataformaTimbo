import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  HandshakeIcon,
  JusticeScale01Icon,
  Location01Icon,
  RepairIcon,
  TruckDeliveryIcon,
} from '@hugeicons/core-free-icons';
import { useMemo, useState } from 'react';
import { AppIcon } from '../../ui/app-icon';
import {
  filterByVehicleLocationSegment,
  getVehicleLocationOptions,
  getVehicleLocationSegment,
  type VehicleGroup,
  type VehicleLocationSegment,
} from '../../vehicle-catalog/vehicle-catalog';

const LOCATION_SEGMENTS: {
  key: VehicleLocationSegment;
  label: string;
  icon: typeof CheckmarkCircle02Icon;
}[] = [
  { key: 'stripped', label: 'Carneados', icon: RepairIcon },
  { key: 'committed', label: 'Comprometidos', icon: HandshakeIcon },
  { key: 'available', label: 'Disponibles', icon: CheckmarkCircle02Icon },
  { key: 'in-transit', label: 'En tránsito', icon: TruckDeliveryIcon },
  { key: 'judicial', label: 'Judiciales', icon: JusticeScale01Icon },
];

interface LocationSegmentationProps {
  groups: Map<string, VehicleGroup>;
  locationSegment: VehicleLocationSegment | undefined;
  location: string;
  onLocationSegmentChange: (segment: VehicleLocationSegment) => void;
  onLocationChange: (location: string) => void;
}

export function LocationSegmentation({
  groups,
  locationSegment,
  location,
  onLocationSegmentChange,
  onLocationChange,
}: LocationSegmentationProps): React.JSX.Element {
  const [locationOptionsExpanded, setLocationOptionsExpanded] = useState(false);
  const locationSegmentCounts = useMemo(() => {
    const counts = new Map<VehicleLocationSegment, number>();
    for (const group of groups.values()) {
      for (const unit of group.units) {
        const segment = getVehicleLocationSegment(unit);
        if (segment !== undefined) {
          counts.set(segment, (counts.get(segment) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [groups]);
  const selectedSegmentGroups = useMemo(
    () =>
      locationSegment === undefined
        ? new Map<string, VehicleGroup>()
        : filterByVehicleLocationSegment(groups, locationSegment),
    [groups, locationSegment],
  );
  const locationOptions = useMemo(
    () => getVehicleLocationOptions(selectedSegmentGroups),
    [selectedSegmentGroups],
  );
  const selectedLocationOption = locationOptions.find((option) => option.label === location);

  const handleLocationSegmentChange = (segment: VehicleLocationSegment): void => {
    setLocationOptionsExpanded(false);
    onLocationSegmentChange(segment);
  };

  const handleLocationChange = (nextLocation: string): void => {
    setLocationOptionsExpanded(false);
    onLocationChange(nextLocation);
  };

  return (
    <section className="lp-location-segments" aria-label="Segmentar por ubicación">
      <div className="lp-location-segments-primary">
        {LOCATION_SEGMENTS.map(({ key, label, icon }) => {
          const count = locationSegmentCounts.get(key) ?? 0;
          const isActive = locationSegment === key;
          return (
            <button
              key={key}
              className={`lp-location-segment${isActive ? ' lp-location-segment--active' : ''}`}
              type="button"
              aria-pressed={isActive}
              aria-label={`${label}: ${count} ${count === 1 ? 'unidad' : 'unidades'}`}
              disabled={count === 0 && !isActive}
              onClick={() => handleLocationSegmentChange(key)}
            >
              <AppIcon icon={icon} size={18} />
              <span className="lp-location-segment-label">{label}</span>
              <span className="lp-location-segment-count">{count}</span>
            </button>
          );
        })}
      </div>

      {locationSegment !== undefined ? (
        <div className="lp-location-segments-secondary" aria-label="Ubicaciones">
          <button
            className="lp-location-options-toggle"
            type="button"
            aria-expanded={locationOptionsExpanded}
            aria-controls="lp-location-options"
            aria-label={
              selectedLocationOption === undefined
                ? `Ver ${locationOptions.length} ${
                    locationOptions.length === 1
                      ? 'ubicación disponible'
                      : 'ubicaciones disponibles'
                  }`
                : `Cambiar ubicación seleccionada: ${selectedLocationOption.label}`
            }
            onClick={() => setLocationOptionsExpanded((expanded) => !expanded)}
          >
            <span className="lp-location-options-toggle-summary">
              <AppIcon icon={Location01Icon} size={17} />
              {selectedLocationOption === undefined ? (
                <span>
                  Ubicaciones disponibles <strong>{locationOptions.length}</strong>
                </span>
              ) : (
                <span>
                  Ubicación: {selectedLocationOption.label}{' '}
                  <strong>{selectedLocationOption.count}</strong>
                </span>
              )}
            </span>
            <span className="lp-location-options-toggle-action">
              {locationOptionsExpanded
                ? 'Ocultar'
                : selectedLocationOption === undefined
                  ? 'Ver todas'
                  : 'Cambiar'}
              <AppIcon icon={locationOptionsExpanded ? ArrowUp01Icon : ArrowDown01Icon} size={16} />
            </span>
          </button>

          <div
            id="lp-location-options"
            className={`lp-location-options${
              locationOptionsExpanded ? ' lp-location-options--expanded' : ''
            }`}
          >
            <span className="lp-location-segments-secondary-label">
              <AppIcon icon={Location01Icon} size={15} />
              Ubicación
            </span>
            {locationOptions.map(({ label, count }) => {
              const isActive = location === label;
              return (
                <button
                  key={label}
                  className={`lp-location-option${isActive ? ' lp-location-option--active' : ''}`}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${label}: ${count} ${count === 1 ? 'unidad' : 'unidades'}`}
                  onClick={() => handleLocationChange(label)}
                >
                  <span>{label}</span>
                  <span className="lp-location-option-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
