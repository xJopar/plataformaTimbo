import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import { UsageEventsService } from '../usage-events/usage-events.service';
import { ListaPreciosUsageEventRequestDto } from './dto/lista-precios-usage-event-request.dto';
import {
  EquipmentRentalResponseDto,
  toEquipmentRentalResponse,
} from './dto/equipment-rental-response.dto';
import { toVehicleResponse, VehicleImageDto, VehicleResponseDto } from './dto/vehicle-response.dto';
import { ListaPreciosApplicationAccessGuard } from './lista-precios-application-access.guard';
import { ListaPreciosProviderUnavailableError } from './lista-precios.errors';
import { ListaPreciosService } from './lista-precios.service';
import { VehicleImagesService } from './vehicle-images.service';

/** 7 días frescos + 1 día de gracia para revalidar en segundo plano sin bloquear al usuario. */
const IMAGE_CACHE_CONTROL = 'public, max-age=604800, stale-while-revalidate=86400';
import {
  LISTA_PRECIOS_BRAND_MAX_LENGTH,
  LISTA_PRECIOS_MODEL_MAX_LENGTH,
  createListaPreciosModelTarget,
  isListaPreciosUsageEventName,
  requiresListaPreciosModel,
  type ListaPreciosUsageEventRequest,
} from './lista-precios-usage-events';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

@ApiTags('applications')
@Controller('applications/lista-precios')
@UseGuards(SessionAuthenticationGuard, ListaPreciosApplicationAccessGuard)
export class ListaPreciosController {
  public constructor(
    private readonly listaPreciosService: ListaPreciosService,
    private readonly usageEventsService: UsageEventsService,
    private readonly vehicleImagesService: VehicleImagesService,
  ) {}

  @Get('vehicles')
  @ApiOperation({
    operationId: 'listListaPreciosVehicles',
    summary: 'Obtiene el catálogo de vehículos en stock desde Zoho Analytics.',
  })
  @ApiOkResponse({ type: VehicleResponseDto, isArray: true })
  @ApiBadGatewayResponse({ description: 'Zoho Analytics no está disponible.' })
  public async getVehicles(): Promise<VehicleResponseDto[]> {
    try {
      const rows = await this.listaPreciosService.getVehicles();
      return rows.map(toVehicleResponse);
    } catch (error) {
      if (error instanceof ListaPreciosProviderUnavailableError) {
        throw new BadGatewayException(
          {
            code: 'LISTA_PRECIOS_UNAVAILABLE',
            message: 'No pudimos obtener el catálogo de vehículos. Intentá nuevamente.',
          },
          { cause: error },
        );
      }
      throw error;
    }
  }

  @Get('vehicles/:stock/images')
  @ApiOperation({
    operationId: 'getListaPreciosVehicleImages',
    summary: 'Obtiene las keys de las fotos (completa + miniatura) de un Stock, si tiene.',
  })
  @ApiOkResponse({ type: VehicleImageDto, isArray: true })
  public async getVehicleImages(@Param('stock') stock: string): Promise<VehicleImageDto[]> {
    return this.vehicleImagesService.getImages(stock);
  }

  @Get('images')
  @ApiOperation({
    operationId: 'getListaPreciosImage',
    summary: 'Transmite una foto del bucket por su key, con caché de navegador de larga duración.',
  })
  public async getImage(@Query('key') key: string | undefined, @Res() res: Response): Promise<void> {
    const image = await this.vehicleImagesService.streamImage(key ?? '');
    if (image === null) {
      throw new NotFoundException({
        code: 'LISTA_PRECIOS_IMAGE_NOT_FOUND',
        message: 'La foto solicitada no existe.',
      });
    }
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', IMAGE_CACHE_CONTROL);
    image.body.pipe(res);
  }

  @Get('equipment-rentals')
  @ApiOperation({
    operationId: 'listListaPreciosEquipmentRentals',
    summary: 'Obtiene las tarifas de alquiler de maquinarias desde Zoho Analytics.',
  })
  @ApiOkResponse({ type: EquipmentRentalResponseDto, isArray: true })
  @ApiBadGatewayResponse({ description: 'Zoho Analytics no está disponible.' })
  public async getEquipmentRentals(): Promise<EquipmentRentalResponseDto[]> {
    try {
      const rows = await this.listaPreciosService.getEquipmentRentals();
      return rows.map(toEquipmentRentalResponse);
    } catch (error) {
      if (error instanceof ListaPreciosProviderUnavailableError) {
        throw new BadGatewayException(
          {
            code: 'LISTA_PRECIOS_UNAVAILABLE',
            message: 'No pudimos obtener las tarifas de alquiler. Intentá nuevamente.',
          },
          { cause: error },
        );
      }
      throw error;
    }
  }

  @Post('usage-events')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'recordListaPreciosUsageEvent',
    summary: 'Registra un hito de uso permitido de Lista de Precios.',
  })
  @ApiNoContentResponse({ description: 'El evento fue procesado sin interrumpir el recorrido.' })
  @ApiBadRequestResponse({ description: 'El evento de uso no cumple el contrato permitido.' })
  public async recordUsageEvent(
    @Body() body: ListaPreciosUsageEventRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const authenticatedUser = request.authenticatedUser;
    if (authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    const usageEvent = parseListaPreciosUsageEventRequest(body);

    if (usageEvent.eventName === 'lista-precios.catalog_opened') {
      await this.usageEventsService.append({
        eventId: usageEvent.eventId,
        actorUserId: authenticatedUser.id,
        eventName: usageEvent.eventName,
        visitId: usageEvent.visitId,
      });
      return;
    }

    await this.usageEventsService.append({
      eventId: usageEvent.eventId,
      actorUserId: authenticatedUser.id,
      eventName: usageEvent.eventName,
      visitId: usageEvent.visitId,
      target: createListaPreciosModelTarget(usageEvent.brand, usageEvent.model),
      metadata: { brand: usageEvent.brand, model: usageEvent.model },
    });
  }
}

function parseListaPreciosUsageEventRequest(
  body: ListaPreciosUsageEventRequestDto,
): ListaPreciosUsageEventRequest {
  if (!UUID_PATTERN.test(body.eventId) || !UUID_PATTERN.test(body.visitId)) {
    throw new BadRequestException({
      code: 'LISTA_PRECIOS_USAGE_IDENTIFIERS_INVALID',
      message: 'Los identificadores de uso deben ser UUID válidos.',
    });
  }
  if (!isListaPreciosUsageEventName(body.eventName)) {
    throw new BadRequestException({
      code: 'LISTA_PRECIOS_USAGE_EVENT_INVALID',
      message: 'El evento de uso de Lista de Precios no está permitido.',
    });
  }
  if (!requiresListaPreciosModel(body.eventName)) {
    if (body.brand !== undefined || body.model !== undefined) {
      throw new BadRequestException({
        code: 'LISTA_PRECIOS_USAGE_MODEL_UNEXPECTED',
        message: 'La apertura del catálogo no admite marca ni modelo.',
      });
    }
    return { eventId: body.eventId, visitId: body.visitId, eventName: body.eventName };
  }
  if (
    !isNonEmptyStringWithin(body.brand, LISTA_PRECIOS_BRAND_MAX_LENGTH) ||
    !isNonEmptyStringWithin(body.model, LISTA_PRECIOS_MODEL_MAX_LENGTH)
  ) {
    throw new BadRequestException({
      code: 'LISTA_PRECIOS_USAGE_MODEL_INVALID',
      message: 'El evento de uso requiere una marca y un modelo válidos.',
    });
  }
  return {
    eventId: body.eventId,
    visitId: body.visitId,
    eventName: body.eventName,
    brand: body.brand.trim(),
    model: body.model.trim(),
  };
}

function isNonEmptyStringWithin(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
