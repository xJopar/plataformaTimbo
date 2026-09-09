import { ApiProperty } from '@nestjs/swagger';

export class PreauthorizeAdministrativeUserDto {
  @ApiProperty({ example: 'persona@timbo.com' })
  corporateEmail!: string;
}

export class PreauthorizeAdministrativeUsersBulkDto {
  @ApiProperty({ type: [PreauthorizeAdministrativeUserDto] })
  entries!: PreauthorizeAdministrativeUserDto[];
}
