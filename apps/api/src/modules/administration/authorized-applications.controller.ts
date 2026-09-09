import { Controller, Get, Inject, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import { ADMINISTRATIVE_APPLICATIONS_SERVICE } from './administration.tokens';
import type { ApplicationsService } from './applications.service';
import {
  AuthorizedApplicationResponseDto,
  toAuthorizedApplicationResponse,
} from './dto/authorized-application-response.dto';

@ApiTags('applications')
@Controller('applications')
@UseGuards(SessionAuthenticationGuard)
export class AuthorizedApplicationsController {
  public constructor(
    @Inject(ADMINISTRATIVE_APPLICATIONS_SERVICE)
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listAuthorizedApplications',
    summary: 'Lista las aplicaciones activas asignadas al usuario autenticado.',
  })
  @ApiOkResponse({ type: AuthorizedApplicationResponseDto, isArray: true })
  public async listApplications(
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthorizedApplicationResponseDto[]> {
    if (request.authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }

    return (
      await this.applicationsService.listAuthorizedApplications(request.authenticatedUser.id)
    ).map(toAuthorizedApplicationResponse);
  }
}
