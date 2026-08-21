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
import { PreauthorizeAdministrativeUserDto } from './dto/preauthorize-administrative-user.dto';
import { UpdateAdministrativeUserDto } from './dto/update-administrative-user.dto';
import { ADMINISTRATIVE_USERS_SERVICE } from './administration.tokens';

@ApiTags('administration')
@Controller('admin/users')
@UseGuards(SessionAuthenticationGuard, PlatformAdministratorGuard)
export class AdministrativeUsersController {
  public constructor(
    @Inject(ADMINISTRATIVE_USERS_SERVICE) private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listAdministrativeUsers',
    summary: 'Lista usuarios para Administración.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Texto a buscar en el correo corporativo.',
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
      displayName: body.displayName,
      actorUserId: this.getActorUserId(request),
    });
    return toAdministrativeUserResponse({ ...user, isPlatformAdministrator: false });
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

  private getActorUserId(request: AuthenticatedRequest): string {
    if (request.authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    return request.authenticatedUser.id;
  }
}
