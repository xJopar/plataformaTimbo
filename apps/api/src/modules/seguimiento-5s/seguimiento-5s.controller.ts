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
  Put,
  Query,
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
import type { ApplicationAuthorizationService } from '../access-profiles/application-authorization.service';
import { APPLICATION_AUTHORIZATION_SERVICE } from '../access-profiles/access-profiles.tokens';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import {
  FiveSCapabilitiesResponseDto,
  FiveSDashboardSummaryResponseDto,
} from './dto/dashboard-summary.dto';
import {
  FiveSDailyEntriesResponseDto,
  SaveFiveSDailyEntriesRequestDto,
} from './dto/daily-entry.dto';
import {
  CreateFiveSIndicatorDto,
  FiveSIndicatorResponseDto,
  UpdateFiveSIndicatorDto,
} from './dto/indicator.dto';
import {
  FIVE_S_ROLE_KEYS,
  FiveSParticipantResponseDto,
  SetFiveSParticipantRoleDto,
} from './dto/participant.dto';
import {
  SEGUIMIENTO_5S_APPLICATION_KEY,
  Seguimiento5sApplicationAccessGuard,
} from './seguimiento-5s-application-access.guard';
import {
  Seguimiento5sEntryManagementGuard,
  Seguimiento5sIndicatorManagementGuard,
  Seguimiento5sParticipantManagementGuard,
} from './seguimiento-5s-permission.guards';
import { type FiveSIndicator, FiveSEntryValue } from '../../generated/prisma/client';
import { Seguimiento5sService } from './seguimiento-5s.service';

const DEFAULT_DASHBOARD_RANGE_DAYS = 14;

@ApiTags('applications')
@Controller('applications/seguimiento-5s')
@UseGuards(SessionAuthenticationGuard, Seguimiento5sApplicationAccessGuard)
export class Seguimiento5sController {
  public constructor(
    private readonly seguimiento5sService: Seguimiento5sService,
    @Inject(APPLICATION_AUTHORIZATION_SERVICE)
    private readonly applicationAuthorizationService: ApplicationAuthorizationService,
  ) {}

  @Get('capabilities')
  @ApiOperation({
    operationId: 'getSeguimiento5sCapabilities',
    summary: 'Obtiene las acciones habilitadas para la sesión en Seguimiento 5S.',
  })
  @ApiOkResponse({ type: FiveSCapabilitiesResponseDto })
  public async getCapabilities(
    @Req() request: AuthenticatedRequest,
  ): Promise<FiveSCapabilitiesResponseDto> {
    const userId = this.requireActorUserId(request);
    const [canManageIndicators, canManageEntries, canManageParticipants] = await Promise.all([
      this.applicationAuthorizationService.hasApplicationPermission(
        userId,
        SEGUIMIENTO_5S_APPLICATION_KEY,
        'manage-indicators',
      ),
      this.applicationAuthorizationService.hasApplicationPermission(
        userId,
        SEGUIMIENTO_5S_APPLICATION_KEY,
        'manage-entries',
      ),
      this.applicationAuthorizationService.hasApplicationPermission(
        userId,
        SEGUIMIENTO_5S_APPLICATION_KEY,
        'manage-participants',
      ),
    ]);
    return { canManageIndicators, canManageEntries, canManageParticipants };
  }

  @Get('indicators')
  @ApiOperation({
    operationId: 'listSeguimiento5sIndicators',
    summary: 'Lista los indicadores 5S activos (o todos, si se pide explícitamente).',
  })
  @ApiOkResponse({ type: FiveSIndicatorResponseDto, isArray: true })
  public async listIndicators(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<FiveSIndicatorResponseDto[]> {
    const indicators = await this.seguimiento5sService.listIndicators(includeInactive === 'true');
    return indicators.map(toIndicatorResponse);
  }

  @Post('indicators')
  @UseGuards(CsrfProtectionGuard, Seguimiento5sIndicatorManagementGuard)
  @ApiOperation({ operationId: 'createSeguimiento5sIndicator', summary: 'Crea un indicador 5S.' })
  @ApiCreatedResponse({ type: FiveSIndicatorResponseDto })
  public async createIndicator(
    @Body() body: CreateFiveSIndicatorDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<FiveSIndicatorResponseDto> {
    const indicator = await this.seguimiento5sService.createIndicator({
      key: this.requireString(body.key, 'key'),
      name: this.requireString(body.name, 'name'),
      controlledSince: this.requireString(body.controlledSince, 'controlledSince'),
      ...(body.displayOrder === undefined ? {} : { displayOrder: body.displayOrder }),
      actorUserId: this.requireActorUserId(request),
    });
    return toIndicatorResponse(indicator);
  }

  @Patch('indicators/:id')
  @UseGuards(CsrfProtectionGuard, Seguimiento5sIndicatorManagementGuard)
  @ApiOperation({ operationId: 'updateSeguimiento5sIndicator', summary: 'Edita un indicador 5S.' })
  @ApiOkResponse({ type: FiveSIndicatorResponseDto })
  public async updateIndicator(
    @Param('id') id: string,
    @Body() body: UpdateFiveSIndicatorDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<FiveSIndicatorResponseDto> {
    const indicator = await this.seguimiento5sService.updateIndicator({
      indicatorId: id,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.controlledSince === undefined ? {} : { controlledSince: body.controlledSince }),
      ...(body.displayOrder === undefined ? {} : { displayOrder: body.displayOrder }),
      actorUserId: this.requireActorUserId(request),
    });
    return toIndicatorResponse(indicator);
  }

  @Post('indicators/:id/deactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard, Seguimiento5sIndicatorManagementGuard)
  @ApiOperation({
    operationId: 'deactivateSeguimiento5sIndicator',
    summary: 'Desactiva un indicador 5S.',
  })
  @ApiNoContentResponse()
  public async deactivateIndicator(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.seguimiento5sService.setIndicatorActive({
      indicatorId: id,
      active: false,
      actorUserId: this.requireActorUserId(request),
    });
  }

  @Post('indicators/:id/reactivate')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard, Seguimiento5sIndicatorManagementGuard)
  @ApiOperation({
    operationId: 'reactivateSeguimiento5sIndicator',
    summary: 'Reactiva un indicador 5S.',
  })
  @ApiNoContentResponse()
  public async reactivateIndicator(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.seguimiento5sService.setIndicatorActive({
      indicatorId: id,
      active: true,
      actorUserId: this.requireActorUserId(request),
    });
  }

  @Get('participants')
  @ApiOperation({
    operationId: 'listSeguimiento5sParticipants',
    summary: 'Lista a los empleados asignados con su rol dentro de Seguimiento 5S.',
  })
  @ApiOkResponse({ type: FiveSParticipantResponseDto, isArray: true })
  public async listParticipants(): Promise<FiveSParticipantResponseDto[]> {
    return this.seguimiento5sService.listParticipants();
  }

  @Post('participants/:userId/role')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard, Seguimiento5sParticipantManagementGuard)
  @ApiOperation({
    operationId: 'setSeguimiento5sParticipantRole',
    summary: 'Asigna el rol de líder o miembro a un participante.',
  })
  @ApiNoContentResponse()
  public async setParticipantRole(
    @Param('userId') userId: string,
    @Body() body: SetFiveSParticipantRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    if (!FIVE_S_ROLE_KEYS.includes(body.roleKey)) {
      throw new BadRequestException('El rol indicado no es válido.');
    }
    await this.seguimiento5sService.setParticipantRole({
      userId,
      roleKey: body.roleKey,
      actorUserId: this.requireActorUserId(request),
    });
  }

  @Get('entries')
  @ApiOperation({
    operationId: 'getSeguimiento5sDailyEntries',
    summary: 'Obtiene el checklist diario de todo el equipo para una fecha.',
  })
  @ApiOkResponse({ type: FiveSDailyEntriesResponseDto })
  public async getDailyEntries(@Query('date') date: string): Promise<FiveSDailyEntriesResponseDto> {
    return this.seguimiento5sService.getDailyEntries(this.requireString(date, 'date'));
  }

  @Put('entries')
  @UseGuards(CsrfProtectionGuard, Seguimiento5sEntryManagementGuard)
  @ApiOperation({
    operationId: 'saveSeguimiento5sDailyEntries',
    summary: 'Guarda el checklist diario de todo el equipo para una fecha.',
  })
  @ApiOkResponse({ type: FiveSDailyEntriesResponseDto })
  public async saveDailyEntries(
    @Body() body: SaveFiveSDailyEntriesRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<FiveSDailyEntriesResponseDto> {
    if (!Array.isArray(body.entries)) {
      throw new BadRequestException('El campo "entries" debe ser una lista.');
    }
    const entries = body.entries.map((item) => {
      if (!Object.values(FiveSEntryValue).includes(item.value)) {
        throw new BadRequestException('El valor de un registro no es válido.');
      }
      return {
        userId: this.requireString(item.userId, 'userId'),
        indicatorId: this.requireString(item.indicatorId, 'indicatorId'),
        value: item.value,
      };
    });
    return this.seguimiento5sService.saveDailyEntries({
      entryDate: this.requireString(body.entryDate, 'entryDate'),
      entries,
      actorUserId: this.requireActorUserId(request),
    });
  }

  @Get('dashboard/summary')
  @ApiOperation({
    operationId: 'getSeguimiento5sDashboardSummary',
    summary: 'Obtiene los indicadores del dashboard y la serie diaria de cumplimiento ponderado.',
  })
  @ApiOkResponse({ type: FiveSDashboardSummaryResponseDto })
  public async getDashboardSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<FiveSDashboardSummaryResponseDto> {
    const resolvedTo = to ?? new Date().toISOString().slice(0, 10);
    const resolvedFrom =
      from ??
      new Date(
        new Date(`${resolvedTo}T00:00:00.000Z`).getTime() -
          (DEFAULT_DASHBOARD_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
    return this.seguimiento5sService.getDashboardSummary({ from: resolvedFrom, to: resolvedTo });
  }

  private requireActorUserId(request: AuthenticatedRequest): string {
    if (request.authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    return request.authenticatedUser.id;
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`El campo "${field}" es obligatorio.`);
    }
    return value;
  }
}

function toIndicatorResponse(indicator: FiveSIndicator): FiveSIndicatorResponseDto {
  return {
    id: indicator.id,
    key: indicator.key,
    name: indicator.name,
    controlledSince: indicator.controlledSince.toISOString().slice(0, 10),
    displayOrder: indicator.displayOrder,
    status: indicator.status,
  };
}
