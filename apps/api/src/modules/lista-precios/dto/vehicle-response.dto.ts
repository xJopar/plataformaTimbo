import { ApiProperty } from '@nestjs/swagger';
import type { ZohoVehicleRow } from '../lista-precios.service';

/**
 * Un registro de la vista de Zoho Analytics ya son todas strings (posiblemente vacías): la
 * vista no distingue "sin dato" de "" y no hay forma de inferir tipos numéricos/fecha de forma
 * confiable columna por columna, así que el parseo (precio, fechas, años) queda del lado del
 * consumidor, igual que hacía `dataProcessor.js` en el proyecto original.
 */
export class VehicleResponseDto {
  @ApiProperty() marca!: string;
  @ApiProperty() modelo!: string;
  @ApiProperty() anioFab!: string;
  @ApiProperty() config!: string;
  @ApiProperty() susp!: string;
  @ApiProperty() tipoMotor!: string;
  @ApiProperty() tipoCabina!: string;
  @ApiProperty() tipoCaja!: string;
  @ApiProperty() aire!: string;
  @ApiProperty() color!: string;
  @ApiProperty() km!: string;
  @ApiProperty() precioLista!: string;
  @ApiProperty() ubicacion!: string;
  @ApiProperty() fechaSena!: string;
  @ApiProperty() vendedorSena!: string;
  @ApiProperty() uComentario!: string;
  @ApiProperty() disponible!: string;
  @ApiProperty() tipoUnidad!: string;
  @ApiProperty() uso!: string;
  @ApiProperty() inyeccion!: string;
  @ApiProperty() altura!: string;
  @ApiProperty() piso!: string;
  @ApiProperty() tipo!: string;
  @ApiProperty() chasis!: string;
  @ApiProperty() url!: string;
  @ApiProperty() codGrupo!: string;
  @ApiProperty() comentario!: string;
  @ApiProperty() origen!: string;
  @ApiProperty() kmOrigen!: string;
  @ApiProperty() fechaEntradaTaller!: string;
  @ApiProperty() fechaSalidaTaller!: string;
  @ApiProperty() equipamiento!: string;
  @ApiProperty() laterales!: string;
  @ApiProperty() diasTranscurridos!: string;
  @ApiProperty() ubicacion1!: string;
  @ApiProperty() aproxLlegada!: string;
  @ApiProperty() disponible1!: string;
  @ApiProperty() stock!: string;
}

const VEHICLE_FIELDS = [
  'marca',
  'modelo',
  'anioFab',
  'config',
  'susp',
  'tipoMotor',
  'tipoCabina',
  'tipoCaja',
  'aire',
  'color',
  'km',
  'precioLista',
  'ubicacion',
  'fechaSena',
  'vendedorSena',
  'uComentario',
  'disponible',
  'tipoUnidad',
  'uso',
  'inyeccion',
  'altura',
  'piso',
  'tipo',
  'chasis',
  'url',
  'codGrupo',
  'comentario',
  'origen',
  'kmOrigen',
  'fechaEntradaTaller',
  'fechaSalidaTaller',
  'equipamiento',
  'laterales',
  'diasTranscurridos',
  'ubicacion1',
  'aproxLlegada',
  'disponible1',
  'stock',
] as const satisfies readonly (keyof VehicleResponseDto)[];

export function toVehicleResponse(row: ZohoVehicleRow): VehicleResponseDto {
  const response = {} as VehicleResponseDto;
  for (const field of VEHICLE_FIELDS) {
    response[field] = row[field] ?? '';
  }
  return response;
}
