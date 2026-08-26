import { ApiProperty } from '@nestjs/swagger';

export class AuthSessionResponseDto {
  @ApiProperty({ example: 'd9e7d1f5-4c1e-4a77-9b63-4f37b755f1d6' })
  id!: string;

  @ApiProperty({ example: 'persona@timbo.com' })
  corporateEmail!: string;

  @ApiProperty({ example: 'Persona Timbo', nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ example: false })
  isPlatformAdministrator!: boolean;
}
