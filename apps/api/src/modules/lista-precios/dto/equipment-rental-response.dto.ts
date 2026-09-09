import { ApiProperty } from '@nestjs/swagger';
import type { ZohoAnalyticsRow } from '../lista-precios.service';

/** Campos públicos de la vista de tarifas de alquiler de maquinarias. */
export class EquipmentRentalResponseDto {
  @ApiProperty()
  description!: string;

  @ApiProperty()
  capacity!: string;

  @ApiProperty()
  tariff!: string;
}

const EQUIPMENT_RENTAL_FIELDS = [
  'description',
  'capacity',
  'tariff',
] as const satisfies readonly (keyof EquipmentRentalResponseDto)[];

export function toEquipmentRentalResponse(row: ZohoAnalyticsRow): EquipmentRentalResponseDto {
  const response = {} as EquipmentRentalResponseDto;
  for (const field of EQUIPMENT_RENTAL_FIELDS) {
    response[field] = row[field] ?? '';
  }
  return response;
}
