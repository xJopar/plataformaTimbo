import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApplicationProfileDto {
  @ApiProperty() public key!: string;
  @ApiProperty() public name!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) public description?: string | null;
}
export class UpdateApplicationProfileDto {
  @ApiPropertyOptional() public name?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) public description?: string | null;
}
