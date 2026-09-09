import { ApiProperty } from '@nestjs/swagger';

export class AdministrativeUserApplicationAccessResponseDto {
  @ApiProperty({ format: 'uuid' })
  public applicationId!: string;
  @ApiProperty({ format: 'date-time' })
  public assignedAt!: string;
  @ApiProperty({ type: String, isArray: true })
  public profileIds!: string[];
}
