import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { VehicleResponse } from '../../api';
import { groupByModel } from '../../vehicle-catalog/vehicle-catalog';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';
import { BrandScreen } from './brand-screen';
import { EMPTY_VARIANT_FILTER_STATE, type VariantFilterState } from './variants-screen';

const BASE_VEHICLE: VehicleResponse = {
  marca: 'Sinotruk',
  modelo: '',
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
    { ...BASE_VEHICLE, modelo: 'Howo', stock: 'ST-1', disponible: 'SI', ubicacion: 'Asunción' },
    { ...BASE_VEHICLE, modelo: 'T5G', stock: 'ST-2', ubicacion: 'Fábrica' },
  ]),
  brands: [],
};

function BrandScreenHarness(): React.JSX.Element {
  const [filterState, setFilterState] = useState<VariantFilterState>(EMPTY_VARIANT_FILTER_STATE);
  return (
    <BrandScreen
      brand="Sinotruk"
      vehiclesState={vehiclesState}
      filterState={filterState}
      onFilterStateChange={setFilterState}
      onSelectModel={() => undefined}
      onSelectSubBrand={() => undefined}
    />
  );
}

describe('BrandScreen', () => {
  it('actualiza las cantidades de modelos con la segmentación elegida', async () => {
    const user = userEvent.setup();
    render(<BrandScreenHarness />);

    expect(screen.getByText('2 modelos')).toBeInTheDocument();
    expect(screen.getByText('Howo')).toBeInTheDocument();
    expect(screen.getByText('T5G')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disponibles: 1 unidad' }));

    expect(screen.getByText('1 modelo')).toBeInTheDocument();
    expect(screen.getByText('Howo')).toBeInTheDocument();
    expect(screen.queryByText('T5G')).not.toBeInTheDocument();
  });
});
