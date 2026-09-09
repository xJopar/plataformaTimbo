import { ApiProperty } from '@nestjs/swagger';
export class AdministrativeApplicationProfileResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public key!: string;
  @ApiProperty() public name!: string;
  @ApiProperty({ type: String, nullable: true }) public description!: string | null;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] }) public status!: 'ACTIVE' | 'INACTIVE';
  @ApiProperty({ type: String, isArray: true }) public permissionIds!: string[];
}
