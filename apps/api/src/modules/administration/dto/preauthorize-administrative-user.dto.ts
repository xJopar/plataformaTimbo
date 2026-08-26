import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreauthorizeAdministrativeUserDto {
  @ApiProperty({ example: 'persona@timbo.com' })
  corporateEmail!: string;

  @ApiPropertyOptional({ example: 'Persona Timbo' })
  displayName?: string;
}

export class PreauthorizeAdministrativeUsersBulkDto {
  @ApiProperty({ type: [PreauthorizeAdministrativeUserDto] })
  entries!: PreauthorizeAdministrativeUserDto[];
}
