import { ApiProperty } from '@nestjs/swagger';
export class AdministrativeApplicationPermissionResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public key!: string;
  @ApiProperty() public name!: string;
  @ApiProperty({ type: String, nullable: true }) public description!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) public status!: 'ACTIVE' | 'INACTIVE';
}
