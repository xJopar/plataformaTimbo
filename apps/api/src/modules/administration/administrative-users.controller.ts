import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ACCESS_PROFILES_SERVICE } from '../access-profiles/access-profiles.tokens';
import type { AccessProfilesService } from '../access-profiles/access-profiles.service';
import {
  InactiveUserCannotBecomePlatformAdministratorError,
  LastPlatformAdministratorCannotBeRevokedError,
  PlatformAdministratorCannotRevokeOwnRoleError,
} from '../access-profiles/access-profiles.errors';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import { AuthPublicError } from '../auth/auth-public.errors';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import type { UsersService } from '../users/users.service';
import { PlatformAdministratorCannotBeDeactivatedError } from '../users/users.errors';
import { PlatformAdministratorGuard } from './platform-administrator.guard';
import {
  AdministrativeUserResponseDto,
  toAdministrativeUserResponse,
} from './dto/administrative-user-response.dto';
import {
  PreauthorizeAdministrativeUserDto,
  PreauthorizeAdministrativeUsersBulkDto,
} from './dto/preauthorize-administrative-user.dto';
import { PreauthorizeAdministrativeUserBulkResultDto } from './dto/preauthorize-administrative-users-bulk-result.dto';
import { UpdateAdministrativeUserDto } from './dto/update-administrative-user.dto';
import {
  BulkAdministrativeUserStatusDto,
  BulkAdministrativeUserStatusResultDto,
} from './dto/bulk-administrative-user-status.dto';
import { ADMINISTRATIVE_USERS_SERVICE } from './administration.tokens';

const MAX_BULK_PREAUTHORIZE_ENTRIES = 200;
const MAX_BULK_USER_STATUS_ENTRIES = 500;

@ApiTags('administration')
@Controller('admin/users')
@UseGuards(SessionAuthenticationGuard, PlatformAdministratorGuard)
export class AdministrativeUsersController {
  public constructor(
    @Inject(ADMINISTRATIVE_USERS_SERVICE) private readonly usersService: UsersService,
    @Inject(ACCESS_PROFILES_SERVICE)
    private readonly accessProfilesService: AccessProfilesService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listAdministrativeUsers',
    summary: 'Lista usuarios para Administración.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Texto a buscar en el correo corporativo o nombre visible.',
  })
  @ApiOkResponse({ type: AdministrativeUserResponseDto, isArray: true })
  public async listUsers(
    @Query('search') search: string | undefined,
  ): Promise<AdministrativeUserResponseDto[]> {
    return (await this.usersService.listAdministrativeUsers({ search })).map(
      toAdministrativeUserResponse,
    );
  }

  @Post()
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'preauthorizeAdministrativeUser',
    summary: 'Preautoriza un usuario.',
  })
  @ApiCreatedResponse({ type: AdministrativeUserResponseDto })
  public async preauthorizeUser(
    @Body() body: PreauthorizeAdministrativeUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdministrativeUserResponseDto> {
    const user = await this.usersService.preauthorizeUserByAdministrator({
      corporateEmail: body.corporateEmail,
      actorUserId: this.getActorUserId(request),
    });
    return toAdministrativeUserResponse({ ...user, isPlatformAdministrator: false });
  }

  @Post('bulk-activate')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'activateAdministrativeUsersBulk',
    summary: 'Activa varios usuarios, informando el resultado de cada uno.',
  })
  @ApiOkResponse({ type: BulkAdministrativeUserStatusResultDto, isArray: true })
  public async activateUsersBulk(
    @Body() body: BulkAdministrativeUserStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BulkAdministrativeUserStatusResultDto[]> {
    return this.usersService.changeUsersStatusByAdministrator({
      userIds: this.requireBulkUserIds(body),
      status: 'ACTIVE',
      actorUserId: this.getActorUserId(request),
    });
  }

  @Post('bulk-deactivate')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'deactivateAdministrativeUsersBulk',
    summary: 'Desactiva varios usuarios, informando el resultado de cada uno.',
  })
  @ApiOkResponse({ type: BulkAdministrativeUserStatusResultDto, isArray: true })
  public async deactivateUsersBulk(
    @Body() body: BulkAdministrativeUserStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BulkAdministrativeUserStatusResultDto[]> {
    return this.usersService.changeUsersStatusByAdministrator({
      userIds: this.requireBulkUserIds(body),
      status: 'INACTIVE',
      actorUserId: this.getActorUserId(request),
    });
  }

  @Post('bulk')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'preauthorizeAdministrativeUsersBulk',
    summary: 'Preautoriza varios usuarios en un lote, informando el resultado de cada correo.',
  })
  @ApiCreatedResponse({ type: PreauthorizeAdministrativeUserBulkResultDto, isArray: true })
  public async preauthorizeUsersBulk(
    @Body() body: PreauthorizeAdministrativeUsersBulkDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PreauthorizeAdministrativeUserBulkResultDto[]> {
    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      throw new BadRequestException('Se debe indicar al menos un correo corporativo.');
    }
    if (body.entries.length > MAX_BULK_PREAUTHORIZE_ENTRIES) {
      throw new BadRequestException(
        `No se pueden preautorizar más de ${MAX_BULK_PREAUTHORIZE_ENTRIES.toString()} usuarios a la vez.`,
      );
    }
    const results = await this.usersService.preauthorizeUsersByAdministrator({
      entries: body.entries,
      actorUserId: this.getActorUserId(request),
    });
    return results.map((result) =>
      result.status === 'CREATED'
        ? {
            corporateEmail: result.corporateEmail,
            status: result.status,
            user: toAdministrativeUserResponse({
              ...result.user,
              isPlatformAdministrator: false,
            }),
          }
        : result,
    );
  }

  @Patch(':userId')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'updateAdministrativeUser',
    summary: 'Actualiza únicamente el nombre visible de un usuario.',
  })
  @ApiOkResponse({ type: AdministrativeUserResponseDto })
  public async updateUser(
    @Param('userId') userId: string,
    @Body() body: UpdateAdministrativeUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdministrativeUserResponseDto> {
    if (!Object.hasOwn(body, 'displayName')) {
      throw new BadRequestException('Se debe indicar el campo permitido displayName.');
    }
    return toAdministrativeUserResponse(
      await this.usersService.updateAdministrativeUser({
        userId,
        displayName: body.displayName,
        actorUserId: this.getActorUserId(request),
      }),
    );
  }

  @Post(':userId/deactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({ operationId: 'deactivateAdministrativeUser', summary: 'Desactiva un usuario.' })
  @ApiNoContentResponse({ description: 'Usuario desactivado.' })
  public async deactivateUser(
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    try {
      const user = await this.usersService.findUserById({ userId });
      await this.usersService.deactivateUser({
        corporateEmail: user.corporateEmail,
        actorUserId: this.getActorUserId(request),
      });
    } catch (error) {
      if (error instanceof PlatformAdministratorCannotBeDeactivatedError) {
        throw new AuthPublicError('PLATFORM_ADMIN_DEACTIVATION_FORBIDDEN', 409);
      }
      throw error;
    }
  }

  @Post(':userId/reactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({ operationId: 'reactivateAdministrativeUser', summary: 'Reactiva un usuario.' })
  @ApiNoContentResponse({ description: 'Usuario reactivado.' })
  public async reactivateUser(
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const user = await this.usersService.findUserById({ userId });
    await this.usersService.reactivateUser({
      corporateEmail: user.corporateEmail,
      actorUserId: this.getActorUserId(request),
    });
  }

  @Post(':userId/platform-administrator')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'grantPlatformAdministrator',
    summary: 'Otorga el rol de administrador de plataforma a un usuario activo.',
  })
  @ApiNoContentResponse({ description: 'Rol administrativo otorgado.' })
  public async grantPlatformAdministrator(
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    try {
      await this.accessProfilesService.grantPlatformAdministrator({
        userId,
        actorUserId: this.getActorUserId(request),
      });
    } catch (error) {
      if (error instanceof InactiveUserCannotBecomePlatformAdministratorError) {
        throw new AuthPublicError('PLATFORM_ADMIN_INACTIVE_USER_FORBIDDEN', 409);
      }
      throw error;
    }
  }

  @Post(':userId/platform-administrator/revoke')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'revokePlatformAdministrator',
    summary: 'Revoca el rol de administrador sin permitir auto-revocación ni último administrador.',
  })
  @ApiNoContentResponse({ description: 'Rol administrativo revocado.' })
  public async revokePlatformAdministrator(
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    try {
      await this.accessProfilesService.revokePlatformAdministrator({
        userId,
        actorUserId: this.getActorUserId(request),
      });
    } catch (error) {
      if (error instanceof PlatformAdministratorCannotRevokeOwnRoleError) {
        throw new AuthPublicError('PLATFORM_ADMIN_SELF_REVOCATION_FORBIDDEN', 409);
      }
      if (error instanceof LastPlatformAdministratorCannotBeRevokedError) {
        throw new AuthPublicError('PLATFORM_ADMIN_LAST_ACTIVE_REVOCATION_FORBIDDEN', 409);
      }
      throw error;
    }
  }

  private requireBulkUserIds(body: BulkAdministrativeUserStatusDto): string[] {
    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      throw new BadRequestException('Se debe indicar al menos un usuario.');
    }
    if (body.userIds.length > MAX_BULK_USER_STATUS_ENTRIES) {
      throw new BadRequestException(
        `No se pueden cambiar más de ${MAX_BULK_USER_STATUS_ENTRIES.toString()} usuarios a la vez.`,
      );
    }
    return [...new Set(body.userIds)];
  }

  private getActorUserId(request: AuthenticatedRequest): string {
    if (request.authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    return request.authenticatedUser.id;
  }
}
