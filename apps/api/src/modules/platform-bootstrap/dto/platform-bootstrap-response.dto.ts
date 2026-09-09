import { ApiProperty } from '@nestjs/swagger';
import { AuthorizedApplicationResponseDto } from '../../administration/dto/authorized-application-response.dto';
import { AuthSessionResponseDto } from '../../auth/dto/auth-session-response.dto';

export class PlatformBootstrapResponseDto {
  @ApiProperty({ type: AuthSessionResponseDto })
  session!: AuthSessionResponseDto;

  @ApiProperty({ type: AuthorizedApplicationResponseDto, isArray: true })
  applications!: AuthorizedApplicationResponseDto[];
}
