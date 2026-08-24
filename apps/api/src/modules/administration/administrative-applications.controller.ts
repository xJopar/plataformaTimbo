import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import type { ApplicationsService } from './applications.service';
import { ADMINISTRATIVE_APPLICATIONS_SERVICE } from './administration.tokens';
import { PlatformAdministratorGuard } from './platform-administrator.guard';
import {
  AdministrativeApplicationResponseDto,
  toAdministrativeApplicationResponse,
} from './dto/administrative-application-response.dto';
import { CreateAdministrativeApplicationDto } from './dto/create-administrative-application.dto';
import { UpdateAdministrativeApplicationDto } from './dto/update-administrative-application.dto';

@ApiTags('administration')
@Controller('admin/applications')
@UseGuards(SessionAuthenticationGuard, PlatformAdministratorGuard)
export class AdministrativeApplicationsController {
  public constructor(
    @Inject(ADMINISTRATIVE_APPLICATIONS_SERVICE)
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listAdministrativeApplications',
    summary: 'Lista aplicaciones para Administración.',
  })
  @ApiOkResponse({ type: AdministrativeApplicationResponseDto, isArray: true })
  public async listApplications(): Promise<AdministrativeApplicationResponseDto[]> {
    return (await this.applicationsService.listAdministrativeApplications()).map(
      toAdministrativeApplicationResponse,
    );
  }

  @Post()
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'createAdministrativeApplication',
    summary: 'Crea una aplicación interna.',
  })
  @ApiCreatedResponse({ type: AdministrativeApplicationResponseDto })
  public async createApplication(
    @Body() body: CreateAdministrativeApplicationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdministrativeApplicationResponseDto> {
    return toAdministrativeApplicationResponse(
      await this.applicationsService.createAdministrativeApplication({
        key: body.key,
        name: body.name,
        description: body.description,
        launchPath: body.launchPath,
        displayOrder: body.displayOrder,
        actorUserId: this.getActorUserId(request),
      }),
    );
  }

  @Patch(':applicationId')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'updateAdministrativeApplication',
    summary: 'Edita los datos mutables de una aplicación.',
  })
  @ApiOkResponse({ type: AdministrativeApplicationResponseDto })
  public async updateApplication(
    @Param('applicationId') applicationId: string,
    @Body() body: UpdateAdministrativeApplicationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdministrativeApplicationResponseDto> {
    return toAdministrativeApplicationResponse(
      await this.applicationsService.updateAdministrativeApplication({
        applicationId,
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(Object.hasOwn(body, 'description') ? { description: body.description } : {}),
        ...(body.launchPath === undefined ? {} : { launchPath: body.launchPath }),
        ...(body.displayOrder === undefined ? {} : { displayOrder: body.displayOrder }),
        actorUserId: this.getActorUserId(request),
      }),
    );
  }

  @Post(':applicationId/deactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'deactivateAdministrativeApplication',
    summary: 'Desactiva una aplicación.',
  })
  @ApiNoContentResponse({ description: 'Aplicación desactivada.' })
  public async deactivateApplication(
    @Param('applicationId') applicationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.applicationsService.deactivateAdministrativeApplication({
      applicationId,
      actorUserId: this.getActorUserId(request),
    });
  }

  @Post(':applicationId/reactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'reactivateAdministrativeApplication',
    summary: 'Reactiva una aplicación.',
  })
  @ApiNoContentResponse({ description: 'Aplicación reactivada.' })
  public async reactivateApplication(
    @Param('applicationId') applicationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.applicationsService.reactivateAdministrativeApplication({
      applicationId,
      actorUserId: this.getActorUserId(request),
    });
  }

  private getActorUserId(request: AuthenticatedRequest): string {
    if (request.authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    return request.authenticatedUser.id;
  }
}
