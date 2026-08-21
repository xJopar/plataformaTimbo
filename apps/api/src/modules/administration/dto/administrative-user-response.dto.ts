import { ApiProperty } from '@nestjs/swagger';
import type { AdministrativeUser } from '../../users/users.service';

export class AdministrativeUserResponseDto {
  @ApiProperty({ example: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6' })
  id!: string;

  @ApiProperty({ example: 'persona@timbo.com' })
  corporateEmail!: string;

  @ApiProperty({ example: 'Persona Timbo', nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE';

  @ApiProperty({ example: '2026-08-21T12:00:00.000Z', format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-21T12:00:00.000Z', format: 'date-time', nullable: true })
  deactivatedAt!: Date | null;

  @ApiProperty({
    example: false,
    description: 'Indica si el usuario tiene la asignación PLATFORM_ADMIN protegida.',
  })
  isPlatformAdministrator!: boolean;
}

export function toAdministrativeUserResponse(
  user: AdministrativeUser,
): AdministrativeUserResponseDto {
  return user;
}
