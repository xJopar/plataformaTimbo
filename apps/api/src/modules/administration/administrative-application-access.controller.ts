import {
  Body,
  Controller,
  Delete,
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
import type { ApplicationAccessService } from './application-access.service';
import { ADMINISTRATIVE_APPLICATION_ACCESS_SERVICE } from './administration.tokens';
import { PlatformAdministratorGuard } from './platform-administrator.guard';
import {
  CreateApplicationProfileDto,
  UpdateApplicationProfileDto,
} from './dto/application-access.dto';
import { AdministrativeApplicationPermissionResponseDto } from './dto/administrative-application-permission-response.dto';
import { AdministrativeApplicationProfileResponseDto } from './dto/administrative-application-profile-response.dto';
import { AdministrativeUserApplicationAccessResponseDto } from './dto/administrative-user-application-access-response.dto';

@ApiTags('administration')
@Controller('admin')
@UseGuards(SessionAuthenticationGuard, PlatformAdministratorGuard)
export class AdministrativeApplicationAccessController {
  public constructor(
    @Inject(ADMINISTRATIVE_APPLICATION_ACCESS_SERVICE)
    private readonly service: ApplicationAccessService,
  ) {}
  @Post('users/:userId/applications/:applicationId')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'assignApplicationToUser',
    summary: 'Asigna una aplicación activa a un usuario activo.',
  })
  @ApiNoContentResponse()
  public async assignApplication(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.assignApplication(this.actor(request), userId, applicationId);
  }
  @Delete('users/:userId/applications/:applicationId')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'unassignApplicationFromUser',
    summary: 'Retira una aplicación y sus perfiles funcionales del usuario.',
  })
  @ApiNoContentResponse()
  public async unassignApplication(
    @Param('userId') userId: string,
    @Param('applicationId') applicationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.unassignApplication(this.actor(request), userId, applicationId);
  }
  @Get('users/:userId/applications')
  @ApiOperation({
    operationId: 'listUserApplicationAccesses',
    summary: 'Lista asignaciones de aplicaciones.',
  })
  @ApiOkResponse({ type: AdministrativeUserApplicationAccessResponseDto, isArray: true })
  public async listUserAccesses(
    @Param('userId') userId: string,
  ): Promise<AdministrativeUserApplicationAccessResponseDto[]> {
    return (await this.service.listUserApplicationAccesses(userId)).map((item) => ({
      applicationId: item.applicationId,
      assignedAt: item.assignedAt.toISOString(),
      profileIds: item.profileIds,
    }));
  }
  @Get('applications/:applicationId/permissions')
  @ApiOperation({
    operationId: 'listApplicationPermissions',
    summary: 'Lista permisos del catálogo de una aplicación.',
  })
  @ApiOkResponse({ type: AdministrativeApplicationPermissionResponseDto, isArray: true })
  public async listPermissions(
    @Param('applicationId') applicationId: string,
  ): Promise<AdministrativeApplicationPermissionResponseDto[]> {
    return (await this.service.listPermissions(applicationId)).map((permission) => ({
      id: permission.id,
      key: permission.key,
      name: permission.name,
      description: permission.description,
      status: permission.status,
    }));
  }
  @Get('applications/:applicationId/profiles')
  @ApiOperation({
    operationId: 'listApplicationProfiles',
    summary: 'Lista perfiles funcionales de una aplicación.',
  })
  @ApiOkResponse({ type: AdministrativeApplicationProfileResponseDto, isArray: true })
  public async listProfiles(
    @Param('applicationId') applicationId: string,
  ): Promise<AdministrativeApplicationProfileResponseDto[]> {
    return (await this.service.listProfiles(applicationId)).map((profile) => ({
      id: profile.id,
      key: profile.key,
      name: profile.name,
      description: profile.description,
      status: profile.status,
      permissionIds: profile.permissions.map((permission) => permission.permissionId),
    }));
  }
  @Post('applications/:applicationId/profiles')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({ operationId: 'createApplicationProfile', summary: 'Crea un perfil funcional.' })
  @ApiCreatedResponse({ type: AdministrativeApplicationProfileResponseDto })
  public async createProfile(
    @Param('applicationId') applicationId: string,
    @Body() body: CreateApplicationProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdministrativeApplicationProfileResponseDto> {
    return toProfileResponse(
      await this.service.createProfile(this.actor(request), {
        applicationId,
        key: body.key,
        name: body.name,
        ...(Object.hasOwn(body, 'description') ? { description: body.description } : {}),
      }),
    );
  }
  @Patch('application-profiles/:profileId')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({ operationId: 'updateApplicationProfile', summary: 'Edita un perfil funcional.' })
  @ApiOkResponse({ type: AdministrativeApplicationProfileResponseDto })
  public async updateProfile(
    @Param('profileId') profileId: string,
    @Body() body: UpdateApplicationProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdministrativeApplicationProfileResponseDto> {
    return toProfileResponse(
      await this.service.updateProfile(this.actor(request), profileId, body),
    );
  }
  @Post('application-profiles/:profileId/deactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'deactivateApplicationProfile',
    summary: 'Desactiva un perfil funcional.',
  })
  @ApiNoContentResponse()
  public async deactivateProfile(
    @Param('profileId') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.setProfileStatus(this.actor(request), profileId, false);
  }
  @Post('application-profiles/:profileId/reactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'reactivateApplicationProfile',
    summary: 'Reactiva un perfil funcional.',
  })
  @ApiNoContentResponse()
  public async reactivateProfile(
    @Param('profileId') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.setProfileStatus(this.actor(request), profileId, true);
  }
  @Post('application-profiles/:profileId/permissions/:permissionId')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'addPermissionToApplicationProfile',
    summary: 'Agrega un permiso del mismo catálogo al perfil.',
  })
  @ApiNoContentResponse()
  public async addPermission(
    @Param('profileId') profileId: string,
    @Param('permissionId') permissionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.addPermission(this.actor(request), profileId, permissionId);
  }
  @Delete('application-profiles/:profileId/permissions/:permissionId')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'removePermissionFromApplicationProfile',
    summary: 'Retira un permiso de un perfil funcional.',
  })
  @ApiNoContentResponse()
  public async removePermission(
    @Param('profileId') profileId: string,
    @Param('permissionId') permissionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.removePermission(this.actor(request), profileId, permissionId);
  }
  @Post('users/:userId/application-profiles/:profileId')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'assignApplicationProfileToUser',
    summary: 'Asigna un perfil funcional a un usuario con acceso a la aplicación.',
  })
  @ApiNoContentResponse()
  public async assignProfile(
    @Param('userId') userId: string,
    @Param('profileId') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.assignProfile(this.actor(request), userId, profileId);
  }
  @Delete('users/:userId/application-profiles/:profileId')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'unassignApplicationProfileFromUser',
    summary: 'Retira un perfil funcional de un usuario.',
  })
  @ApiNoContentResponse()
  public async unassignProfile(
    @Param('userId') userId: string,
    @Param('profileId') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.service.unassignProfile(this.actor(request), userId, profileId);
  }
  private actor(request: AuthenticatedRequest): string {
    if (request.authenticatedUser === undefined)
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    return request.authenticatedUser.id;
  }
}

function toProfileResponse(profile: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  permissions?: { permissionId: string }[];
}): AdministrativeApplicationProfileResponseDto {
  return {
    id: profile.id,
    key: profile.key,
    name: profile.name,
    description: profile.description,
    status: profile.status,
    permissionIds: profile.permissions?.map((permission) => permission.permissionId) ?? [],
  };
}
