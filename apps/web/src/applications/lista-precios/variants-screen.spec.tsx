import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { VehicleResponse } from '../../api';
import { groupByModel } from '../../vehicle-catalog/vehicle-catalog';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';
import {
  EMPTY_VARIANT_FILTER_STATE,
  VariantsScreen,
  type VariantFilterState,
} from './variants-screen';

const BASE_VEHICLE: VehicleResponse = {
  marca: 'Sinotruk',
  modelo: 'Howo',
  anioFab: '2026',
  config: '',
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

const vehiclesState: VehicleCatalogState = {
  status: 'ready',
  groups: groupByModel([
    { ...BASE_VEHICLE, config: '4x2', stock: 'ST-1', disponible: 'SI', ubicacion: 'Asunción' },
    { ...BASE_VEHICLE, config: '6x2', stock: 'ST-2', ubicacion: 'Fábrica' },
    { ...BASE_VEHICLE, config: '8x4', stock: 'ST-3', ubicacion: 'Ciudad del Este' },
    { ...BASE_VEHICLE, config: '6x4', stock: 'ST-4', ubicacion: 'Alquileres' },
  ]),
  brands: [],
};

function VariantScreenHarness(): React.JSX.Element {
  const [filterState, setFilterState] = useState<VariantFilterState>(EMPTY_VARIANT_FILTER_STATE);
  return (
    <VariantsScreen
      brand="Sinotruk"
      modelo="Howo"
      vehiclesState={vehiclesState}
      filterState={filterState}
      onFilterStateChange={setFilterState}
      onSelectVariant={() => undefined}
    />
  );
}

describe('VariantsScreen', () => {
  it('revela solamente las ubicaciones con unidades en el segmento elegido', async () => {
    const user = userEvent.setup();
    render(<VariantScreenHarness />);

    expect(screen.getByRole('button', { name: 'Disponibles: 2 unidades' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'En tránsito: 1 unidad' })).toBeEnabled();
    expect(screen.queryByLabelText('Ubicaciones')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disponibles: 2 unidades' }));

    expect(screen.getByLabelText('Ubicaciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver 2 ubicaciones disponibles' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Ver 2 ubicaciones disponibles' }));
    expect(screen.getByRole('button', { name: 'Asunción: 1 unidad' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ciudad del Este: 1 unidad' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fábrica: 1 unidad' })).not.toBeInTheDocument();
    expect(screen.getByText('2 variantes')).toBeInTheDocument();
  });
});
