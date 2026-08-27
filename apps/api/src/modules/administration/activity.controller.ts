import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Query,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SessionAuthenticationGuard } from '../auth/session-authentication.guard';
import { AuthPublicError } from '../auth/auth-public.errors';
import { PlatformAdministratorGuard } from './platform-administrator.guard';
import type { ActivityService } from './activity.service';
import {
  ActivityExportLimitError,
  ActivityQueryValidationError,
  parseActivityQuery,
} from './activity.contracts';
import { ACTIVITY_SERVICE } from './administration.tokens';

@ApiTags('administration')
@Controller('admin/activity')
@UseGuards(SessionAuthenticationGuard, PlatformAdministratorGuard)
export class ActivityController {
  public constructor(@Inject(ACTIVITY_SERVICE) private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({
    operationId: 'listAdministrativeActivity',
    summary: 'Lista actividad normalizada.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['items', 'total', 'limit', 'offset'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'id',
              'source',
              'actor',
              'appKey',
              'eventName',
              'outcome',
              'visitId',
              'targetType',
              'targetId',
              'target',
              'metadata',
              'occurredAt',
            ],
            properties: {
              id: { type: 'string' },
              source: { type: 'string', enum: ['AUDIT', 'USAGE'] },
              actor: { type: 'string' },
              appKey: { type: 'string' },
              eventName: { type: 'string' },
              outcome: { type: 'string' },
              visitId: { type: 'string', format: 'uuid', nullable: true },
              targetType: { type: 'string', nullable: true },
              targetId: { type: 'string', nullable: true },
              target: { type: 'string', nullable: true },
              metadata: { type: 'object', additionalProperties: { type: 'string' } },
              occurredAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'integer' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
      },
    },
  })
  @ActivityQueryParameters()
  public async list(@Query() rawQuery: Record<string, unknown>) {
    return this.activityService.list(this.parseQuery(rawQuery));
  }

  @Get('stats')
  @ApiOperation({
    operationId: 'getAdministrativeActivityStatistics',
    summary: 'Resume actividad normalizada.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['eventsToday', 'activePeopleToday', 'mostFrequentApp', 'mostFrequentEvent'],
      properties: {
        eventsToday: { type: 'integer' },
        activePeopleToday: { type: 'integer' },
        mostFrequentApp: { type: 'string', nullable: true },
        mostFrequentEvent: { type: 'string', nullable: true },
      },
    },
  })
  @ActivityQueryParameters()
  public async getStatistics(@Query() rawQuery: Record<string, unknown>) {
    return this.activityService.getStatistics(this.parseQuery(rawQuery));
  }

  @Get('options')
  @ApiOperation({
    operationId: 'getAdministrativeActivityFilterOptions',
    summary: 'Lista opciones de filtros de actividad.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        actors: { type: 'array', items: { type: 'string' } },
        sources: { type: 'array', items: { type: 'string' } },
        apps: { type: 'array', items: { type: 'string' } },
        events: { type: 'array', items: { type: 'string' } },
        targets: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ActivityQueryParameters()
  public async getFilterOptions(@Query() rawQuery: Record<string, unknown>) {
    return this.activityService.getFilterOptions(this.parseQuery(rawQuery));
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="actividad-timbo.csv"')
  @ApiProduces('text/csv')
  @ApiOperation({
    operationId: 'exportAdministrativeActivityCsv',
    summary: 'Exporta el filtro completo de actividad.',
  })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ActivityQueryParameters()
  public async exportCsv(@Query() rawQuery: Record<string, unknown>): Promise<string> {
    try {
      return await this.activityService.exportCsv(this.parseQuery(rawQuery));
    } catch (error) {
      if (error instanceof ActivityExportLimitError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private parseQuery(rawQuery: Record<string, unknown>) {
    try {
      return parseActivityQuery(rawQuery);
    } catch (error) {
      if (error instanceof ActivityQueryValidationError) throw new AuthPublicError(error.code, 400);
      throw error;
    }
  }
}

function ActivityQueryParameters(): MethodDecorator {
  return applyDecorators(
    ApiQuery({
      name: 'datePreset',
      required: false,
      enum: ['today', 'week', 'month'],
      description: 'Período rápido. Si se omite, se usa Este mes en la zona horaria de Paraguay.',
    }),
    ApiQuery({
      name: 'dateFrom',
      required: false,
      description: 'Inicio del rango personalizado en Paraguay (YYYY-MM-DD). Requiere dateTo.',
    }),
    ApiQuery({
      name: 'dateTo',
      required: false,
      description:
        'Fin inclusivo del rango personalizado en Paraguay (YYYY-MM-DD). Máximo 366 días.',
    }),
    ApiQuery({
      name: 'asOf',
      required: false,
      description:
        'Marca de tiempo ISO 8601 para compartir exactamente el corte de los períodos rápidos.',
    }),
    ApiQuery({ name: 'actor', required: false }),
    ApiQuery({ name: 'source', required: false, enum: ['AUDIT', 'USAGE'] }),
    ApiQuery({ name: 'appKey', required: false }),
    ApiQuery({ name: 'eventName', required: false }),
    ApiQuery({ name: 'target', required: false }),
    ApiQuery({ name: 'limit', required: false }),
    ApiQuery({ name: 'offset', required: false }),
    ApiBadRequestResponse({
      description:
        'Rango inválido o mayor a 366 días. Códigos: ACTIVITY_DATE_RANGE_INVALID o ACTIVITY_DATE_RANGE_EXCEEDED.',
    }),
  );
}
