import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Api, VehicleResponse } from '../../api';
import { groupByModel } from '../../vehicle-catalog/vehicle-catalog';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';
import { DetailScreen } from './detail-screen';
import { EMPTY_VARIANT_FILTER_STATE } from './variants-screen';

const BASE_VEHICLE: VehicleResponse = {
  marca: 'Sinotruk',
  modelo: 'Howo',
  anioFab: '2026',
  config: '4x2',
  susp: '',
  tipoMotor: '',
  tipoCabina: '',
  tipoCaja: '',
  aire: '',
  color: '',
  km: '',
  precioLista: '',
  ubicacion: '',
  fechaSena: '',
  vendedorSena: '',
  uComentario: '',
  disponible: '',
  tipoUnidad: '',
  uso: '',
  inyeccion: '',
  altura: '',
  piso: '',
  tipo: '',
  chasis: '',
  url: '',
  codGrupo: '',
  comentario: '',
  origen: '',
  kmOrigen: '',
  fechaEntradaTaller: '',
  fechaSalidaTaller: '',
  equipamiento: '',
  laterales: '',
  diasTranscurridos: '',
  ubicacion1: '',
  aproxLlegada: '',
  disponible1: '',
  stock: '',
};

describe('DetailScreen', () => {
  it('conserva las unidades filtradas y hace visible el contexto del filtro', () => {
    const groups = groupByModel([
      {
        ...BASE_VEHICLE,
        stock: 'ST-AVAILABLE',
        disponible: 'SI',
        ubicacion: 'Asunción',
      },
      { ...BASE_VEHICLE, stock: 'ST-TRANSIT', ubicacion: 'Fábrica' },
    ]);
    const [modelKey] = groups.keys();
    const vehiclesState: VehicleCatalogState = { status: 'ready', groups, brands: [] };

    render(
      <DetailScreen
        api={{} as Api}
        modelKey={modelKey ?? ''}
        vehiclesState={vehiclesState}
        variantFilterState={{ ...EMPTY_VARIANT_FILTER_STATE, locationSegment: 'available' }}
        availableApplications={[]}
        whatsAppNumber="595000000000"
        whatsAppMessageTemplate="Hola, {modelo}"
        onConsultationStarted={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('Mostrando 1 de 2 unidades')).toBeInTheDocument();
    expect(screen.getByText('Disponibles')).toBeInTheDocument();
    expect(screen.getByText('ST-AVAILABLE')).toBeInTheDocument();
    expect(screen.queryByText('ST-TRANSIT')).not.toBeInTheDocument();
  });
});
