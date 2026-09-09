import { useCallback, useMemo, useRef, useState } from 'react';
import type { ApplicationComponentProps } from '../application-component';
import { PlatformHeader } from '../../layout/platform-header';
import { PlatformSessionBar } from '../../layout/platform-session-bar';
import { BrandScreen } from './brand-screen';
import { DetailScreen } from './detail-screen';
import { EquipmentRentalsScreen } from './equipment-rentals-screen';
import { HomeScreen } from './home-screen';
import './lista-precios-application.css';
import {
  buildBrandPath,
  buildDetailPath,
  buildEquipmentRentalCategoryPath,
  buildEquipmentRentalsPath,
  buildSuspensionVariantsPath,
  buildVariantsPath,
  getParentPath,
  isHowoNxModel,
  parseListaPreciosRoute,
  type ListaPreciosRoute,
} from './lista-precios-routes';
import {
  useVehicleCatalog,
  type VehicleCatalogState,
} from '../../vehicle-catalog/use-vehicle-catalog';
import { useListaPreciosUsageEvents } from './use-lista-precios-usage-events';
import {
  EMPTY_VARIANT_FILTER_STATE,
  VariantsScreen,
  type VariantFilterState,
} from './variants-screen';
import { SuspensionsScreen } from './suspensions-screen';
import { useEquipmentRentals } from './use-equipment-rentals';

const DEFAULT_WHATSAPP_NUMBER = '595976511016';
const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = 'Hola, ¿está disponible el modelo: {modelo}?';

function getVariantFilterKey(
  brand: string,
  modelo: string,
  suspension: string | undefined,
): string {
  return [brand, modelo, suspension ?? ''].map((part) => part.trim().toUpperCase()).join('|');
}

/** Contexto del catálogo junto al nombre de la aplicación. */
function computeBreadcrumb(
  route: ListaPreciosRoute,
  vehiclesState: VehicleCatalogState,
): string | undefined {
  switch (route.view) {
    case 'home':
      return undefined;
    case 'equipment-rentals':
      return 'Alquiler de maquinarias';
    case 'equipment-rentals-category':
      return `Alquiler de maquinarias · ${route.category}`;
    case 'brand':
      return route.brand;
    case 'suspensions':
      return `${route.brand} ${route.modelo}`;
    case 'variants':
      return route.suspension === undefined
        ? `${route.brand} ${route.modelo}`
        : `${route.brand} ${route.modelo} · ${route.suspension}`;
    case 'detail': {
      if (vehiclesState.status !== 'ready') {
        return vehiclesState.status === 'loading' ? 'Cargando...' : 'Error';
      }
      const group = vehiclesState.groups.get(route.modelKey);
      return group === undefined ? 'Detalle' : `${group.marca} ${group.modelo}`;
    }
    case 'not-found':
      return 'Página no encontrada';
  }
}

function computeBackLabel(
  route: ListaPreciosRoute,
  vehiclesState: VehicleCatalogState,
): string | undefined {
  switch (route.view) {
    case 'home':
      return undefined;
    case 'equipment-rentals':
      return 'Inicio';
    case 'equipment-rentals-category':
      return 'Alquiler de maquinarias';
    case 'brand':
      return 'Marcas';
    case 'suspensions':
      return 'Modelos';
    case 'variants':
      return route.suspension === undefined ? 'Modelos' : 'Suspensiones';
    case 'detail': {
      if (vehiclesState.status !== 'ready') {
        return 'Modelo';
      }
      const group = vehiclesState.groups.get(route.modelKey);
      return group === undefined ? 'Variante' : `Variantes`;
    }
    case 'not-found':
      return 'Inicio';
  }
}

export function ListaPreciosApplication({
  api,
  application,
  availableApplications,
  session,
  pathname,
  isLoggingOut,
  logoutFailure,
  onNavigate,
  onLogout,
}: ApplicationComponentProps): React.JSX.Element {
  const { state: vehiclesState, reload } = useVehicleCatalog(api);
  const internalNavigationCount = useRef(0);
  const [variantFilters, setVariantFilters] = useState<Record<string, VariantFilterState>>({});

  const route = useMemo(
    () => parseListaPreciosRoute(pathname, application.launchPath),
    [pathname, application.launchPath],
  );
  const { state: equipmentRentalsState, reload: reloadEquipmentRentals } = useEquipmentRentals(
    api,
    route.view === 'home' ||
      route.view === 'equipment-rentals' ||
      route.view === 'equipment-rentals-category',
  );
  const { recordConsultationStarted } = useListaPreciosUsageEvents(api, route, vehiclesState);

  const navigateWithinApp = useCallback(
    (nextPathname: string): void => {
      internalNavigationCount.current += 1;
      onNavigate(nextPathname);
    },
    [onNavigate],
  );

  const handleBack = useCallback((): void => {
    if (internalNavigationCount.current > 0) {
      window.history.back();
      return;
    }
    onNavigate(getParentPath(route, application.launchPath));
  }, [route, application.launchPath, onNavigate]);

  const launchPath = application.launchPath;
  const breadcrumb = computeBreadcrumb(route, vehiclesState);
  const backLabel = computeBackLabel(route, vehiclesState);
  const variantFilterKey =
    route.view === 'variants'
      ? getVariantFilterKey(route.brand, route.modelo, route.suspension)
      : undefined;
  const currentVariantFilterState =
    variantFilterKey === undefined
      ? EMPTY_VARIANT_FILTER_STATE
      : (variantFilters[variantFilterKey] ?? EMPTY_VARIANT_FILTER_STATE);
  const detailVariantFilterState =
    route.view !== 'detail'
      ? EMPTY_VARIANT_FILTER_STATE
      : (() => {
          const [brand, modelo, , suspension] = route.modelKey.split('|');
          if (brand === undefined || modelo === undefined) return EMPTY_VARIANT_FILTER_STATE;
          const filterKey = getVariantFilterKey(
            brand,
            modelo,
            isHowoNxModel(brand, modelo) ? suspension : undefined,
          );
          return variantFilters[filterKey] ?? EMPTY_VARIANT_FILTER_STATE;
        })();

  const updateVariantFilterState = useCallback(
    (nextFilterState: VariantFilterState): void => {
      if (variantFilterKey === undefined) return;
      setVariantFilters((current) => ({ ...current, [variantFilterKey]: nextFilterState }));
    },
    [variantFilterKey],
  );

  return (
    <main className="platform-shell lista-precios-shell">
      <PlatformHeader
        applications={availableApplications}
        applicationName={application.name}
        applicationLaunchPath={application.launchPath}
        isLoggingOut={isLoggingOut}
        isPlatformAdministrator={session.isPlatformAdministrator}
        showAdministrationLink={false}
        variant="application"
        breadcrumb={breadcrumb}
        backLabel={backLabel}
        onBack={breadcrumb === undefined ? undefined : handleBack}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <PlatformSessionBar session={session} />

      {logoutFailure === undefined ? null : (
        <p className="lp-logout-error" role="alert">
          No se pudo cerrar la sesión. Intentá nuevamente.
        </p>
      )}

      {route.view === 'home' ? (
        <HomeScreen
          vehiclesState={vehiclesState}
          equipmentRentalsState={equipmentRentalsState}
          onRetry={() => void reload()}
          onSelectBrand={(brand) => navigateWithinApp(buildBrandPath(launchPath, brand))}
          onSelectEquipmentRentals={() => navigateWithinApp(buildEquipmentRentalsPath(launchPath))}
        />
      ) : null}

      {route.view === 'equipment-rentals' || route.view === 'equipment-rentals-category' ? (
        <EquipmentRentalsScreen
          state={equipmentRentalsState}
          onRetry={() => void reloadEquipmentRentals()}
          category={route.view === 'equipment-rentals-category' ? route.category : undefined}
          onSelectCategory={(category) =>
            navigateWithinApp(buildEquipmentRentalCategoryPath(launchPath, category))
          }
        />
      ) : null}

      {route.view === 'brand' ? (
        <BrandScreen
          brand={route.brand}
          vehiclesState={vehiclesState}
          onSelectModel={(modelo) =>
            navigateWithinApp(buildVariantsPath(launchPath, route.brand, modelo))
          }
          onSelectSubBrand={(subBrand) => navigateWithinApp(buildBrandPath(launchPath, subBrand))}
        />
      ) : null}

      {route.view === 'variants' ? (
        <VariantsScreen
          brand={route.brand}
          modelo={route.modelo}
          suspension={route.suspension}
          vehiclesState={vehiclesState}
          onSelectVariant={(modelKey) => navigateWithinApp(buildDetailPath(launchPath, modelKey))}
          filterState={currentVariantFilterState}
          onFilterStateChange={updateVariantFilterState}
        />
      ) : null}

      {route.view === 'suspensions' ? (
        <SuspensionsScreen
          brand={route.brand}
          modelo={route.modelo}
          vehiclesState={vehiclesState}
          onSelectSuspension={(suspension) =>
            navigateWithinApp(
              buildSuspensionVariantsPath(launchPath, route.brand, route.modelo, suspension),
            )
          }
        />
      ) : null}

      {route.view === 'detail' ? (
        <DetailScreen
          api={api}
          modelKey={route.modelKey}
          vehiclesState={vehiclesState}
          variantFilterState={detailVariantFilterState}
          availableApplications={availableApplications}
          whatsAppNumber={import.meta.env.VITE_LISTA_PRECIOS_WA_NUMBER ?? DEFAULT_WHATSAPP_NUMBER}
          whatsAppMessageTemplate={
            import.meta.env.VITE_LISTA_PRECIOS_WA_MESSAGE_TEMPLATE ??
            DEFAULT_WHATSAPP_MESSAGE_TEMPLATE
          }
          onConsultationStarted={recordConsultationStarted}
          onNavigate={onNavigate}
        />
      ) : null}

      {route.view === 'not-found' ? (
        <div className="lp-page">
          <div className="lp-state-box">
            <span className="lp-state-box-title">Página no encontrada</span>
          </div>
        </div>
      ) : null}
    </main>
  );
}
