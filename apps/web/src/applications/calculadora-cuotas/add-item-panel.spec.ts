import { describe, expect, it } from 'vitest';
import type { VehicleResponse } from '../../api';
import { groupByModel } from '../../vehicle-catalog/vehicle-catalog';
import { searchCatalog } from './add-item-panel';

const BASE_VEHICLE: VehicleResponse = {
  marca: '',
  modelo: '',
  anioFab: '',
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

function vehicle(overrides: Partial<VehicleResponse>): VehicleResponse {
  return { ...BASE_VEHICLE, ...overrides };
}

describe('searchCatalog', () => {
  it('omite unidades sin precio de lista', () => {
    const groups = groupByModel([
      vehicle({
        marca: 'Sinotruk',
        modelo: 'Howo',
        config: '6x4',
        stock: 'ST-001',
        precioLista: '70.300',
      }),
      vehicle({
        marca: 'Sinotruk',
        modelo: 'Howo',
        config: '6x4',
        stock: 'ST-002',
        precioLista: '',
      }),
    ]);

    const matches = searchCatalog({ status: 'ready', groups, brands: [] }, 'howo');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.unit.stock).toBe('ST-001');
  });
});
