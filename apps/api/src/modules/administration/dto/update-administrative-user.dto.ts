import { ApiProperty } from '@nestjs/swagger';

export class UpdateAdministrativeUserDto {
  @ApiProperty({ example: 'Persona Timbo', nullable: true, type: String })
  displayName!: string | null;
}
