import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdministrativeUserResponseDto } from './administrative-user-response.dto';

export class PreauthorizeAdministrativeUserBulkResultDto {
  @ApiProperty({ example: 'persona@timbo.com' })
  corporateEmail!: string;

  @ApiProperty({ enum: ['CREATED', 'FAILED'], example: 'CREATED' })
  status!: 'CREATED' | 'FAILED';

  @ApiPropertyOptional({
    example: 'Ya existe un usuario con el correo corporativo indicado.',
    description: 'Motivo del fallo; presente únicamente cuando status es FAILED.',
  })
  message?: string;

  @ApiPropertyOptional({ type: AdministrativeUserResponseDto })
  user?: AdministrativeUserResponseDto;
}
