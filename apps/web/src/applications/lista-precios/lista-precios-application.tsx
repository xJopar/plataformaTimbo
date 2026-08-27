import { useCallback, useMemo, useRef } from 'react';
import type { ApplicationComponentProps } from '../application-component';
import { PlatformHeader } from '../../layout/platform-header';
import { PlatformSessionBar } from '../../layout/platform-session-bar';
import { BrandScreen } from './brand-screen';
import { DetailScreen } from './detail-screen';
import { HomeScreen } from './home-screen';
import './lista-precios-application.css';
import {
  buildBrandPath,
  buildDetailPath,
  buildVariantsPath,
  getParentPath,
  parseListaPreciosRoute,
  type ListaPreciosRoute,
} from './lista-precios-routes';
import {
  useListaPreciosVehicles,
  type ListaPreciosVehiclesState,
} from './use-lista-precios-vehicles';
import { VariantsScreen } from './variants-screen';

const DEFAULT_WHATSAPP_NUMBER = '595976511016';
const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = 'Hola, ¿está disponible el modelo: {modelo}?';

/** Contexto del catálogo junto al nombre de la aplicación. */
function computeBreadcrumb(
  route: ListaPreciosRoute,
  vehiclesState: ListaPreciosVehiclesState,
): string | undefined {
  switch (route.view) {
    case 'home':
      return undefined;
    case 'brand':
      return route.brand;
    case 'variants':
      return `${route.brand} ${route.modelo}`;
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
  vehiclesState: ListaPreciosVehiclesState,
): string | undefined {
  switch (route.view) {
    case 'home':
      return undefined;
    case 'brand':
      return 'Marcas';
    case 'variants':
      return route.brand;
    case 'detail': {
      if (vehiclesState.status !== 'ready') {
        return 'Modelo';
      }
      const group = vehiclesState.groups.get(route.modelKey);
      return group === undefined ? 'Modelo' : `Modelos ${group.marca}`;
    }
    case 'not-found':
      return 'Lista de Precios';
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
  const { state: vehiclesState, reload } = useListaPreciosVehicles(api);
  const internalNavigationCount = useRef(0);

  const route = useMemo(
    () => parseListaPreciosRoute(pathname, application.launchPath),
    [pathname, application.launchPath],
  );

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
          onRetry={() => void reload()}
          onSelectBrand={(brand) => navigateWithinApp(buildBrandPath(launchPath, brand))}
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
          vehiclesState={vehiclesState}
          onSelectVariant={(modelKey) => navigateWithinApp(buildDetailPath(launchPath, modelKey))}
        />
      ) : null}

      {route.view === 'detail' ? (
        <DetailScreen
          modelKey={route.modelKey}
          vehiclesState={vehiclesState}
          whatsAppNumber={import.meta.env.VITE_LISTA_PRECIOS_WA_NUMBER ?? DEFAULT_WHATSAPP_NUMBER}
          whatsAppMessageTemplate={
            import.meta.env.VITE_LISTA_PRECIOS_WA_MESSAGE_TEMPLATE ??
            DEFAULT_WHATSAPP_MESSAGE_TEMPLATE
          }
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
