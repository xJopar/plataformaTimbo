import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import { toAuthorizedApplicationResponse } from '../administration/dto/authorized-application-response.dto';
import { PlatformBootstrapResponseDto } from './dto/platform-bootstrap-response.dto';
import { PlatformBootstrapService } from './platform-bootstrap.service';

@ApiTags('platform')
@Controller('platform')
@UseGuards(SessionAuthenticationGuard)
export class PlatformBootstrapController {
  public constructor(private readonly platformBootstrapService: PlatformBootstrapService) {}

  @Get('bootstrap')
  @ApiOperation({
    operationId: 'getPlatformBootstrap',
    summary: 'Obtiene la sesión y las aplicaciones autorizadas para iniciar la plataforma.',
  })
  @ApiOkResponse({ type: PlatformBootstrapResponseDto })
  public async getBootstrap(
    @Req() request: AuthenticatedRequest,
  ): Promise<PlatformBootstrapResponseDto> {
    if (request.authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }

    const bootstrap = await this.platformBootstrapService.bootstrap(request.authenticatedUser);
    return {
      session: bootstrap.session,
      applications: bootstrap.applications.map(toAuthorizedApplicationResponse),
    };
  }
}
