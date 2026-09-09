import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import { UsageEventsService } from '../usage-events/usage-events.service';
import {
  CALCULADORA_CUOTAS_IMAGE_ID_PATTERN,
  createCalculadoraCuotasImageTarget,
  isCalculadoraCuotasCalculationSource,
  isCalculadoraCuotasUsageEventName,
  type CalculadoraCuotasUsageEventRequest,
} from './calculadora-cuotas-usage-events';
import { CalculadoraCuotasApplicationAccessGuard } from './calculadora-cuotas-application-access.guard';
import { CalculadoraCuotasUsageEventRequestDto } from './dto/calculadora-cuotas-usage-event-request.dto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

@ApiTags('applications')
@Controller('applications/calculadora-cuotas')
@UseGuards(SessionAuthenticationGuard, CalculadoraCuotasApplicationAccessGuard)
export class CalculadoraCuotasController {
  public constructor(private readonly usageEventsService: UsageEventsService) {}

  @Post('usage-events')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'recordCalculadoraCuotasUsageEvent',
    summary: 'Registra un hito de uso permitido de Calculadora de Cuotas.',
  })
  @ApiNoContentResponse({ description: 'El evento fue procesado sin interrumpir el recorrido.' })
  @ApiBadRequestResponse({ description: 'El evento de uso no cumple el contrato permitido.' })
  public async recordUsageEvent(
    @Body() body: CalculadoraCuotasUsageEventRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const authenticatedUser = request.authenticatedUser;
    if (authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    const usageEvent = parseCalculadoraCuotasUsageEventRequest(body);

    if (usageEvent.eventName === 'calculadora-cuotas.image_exported') {
      await this.usageEventsService.append({
        eventId: usageEvent.eventId,
        actorUserId: authenticatedUser.id,
        eventName: usageEvent.eventName,
        visitId: usageEvent.visitId,
        target: createCalculadoraCuotasImageTarget(usageEvent.imageId),
        metadata: { calculationSource: usageEvent.calculationSource },
      });
      return;
    }

    await this.usageEventsService.append({
      eventId: usageEvent.eventId,
      actorUserId: authenticatedUser.id,
      eventName: usageEvent.eventName,
      visitId: usageEvent.visitId,
    });
  }
}

function parseCalculadoraCuotasUsageEventRequest(
  body: CalculadoraCuotasUsageEventRequestDto,
): CalculadoraCuotasUsageEventRequest {
  if (!UUID_PATTERN.test(body.eventId) || !UUID_PATTERN.test(body.visitId)) {
    throw new BadRequestException({
      code: 'CALCULADORA_CUOTAS_USAGE_IDENTIFIERS_INVALID',
      message: 'Los identificadores de uso deben ser UUID válidos.',
    });
  }
  if (!isCalculadoraCuotasUsageEventName(body.eventName)) {
    throw new BadRequestException({
      code: 'CALCULADORA_CUOTAS_USAGE_EVENT_INVALID',
      message: 'El evento de uso de Calculadora de Cuotas no está permitido.',
    });
  }
  if (body.eventName !== 'calculadora-cuotas.image_exported') {
    if (body.imageId !== undefined || body.calculationSource !== undefined) {
      throw new BadRequestException({
        code: 'CALCULADORA_CUOTAS_USAGE_IMAGE_UNEXPECTED',
        message: 'Este hito de uso no admite datos de una imagen.',
      });
    }
    return { eventId: body.eventId, visitId: body.visitId, eventName: body.eventName };
  }
  if (
    typeof body.imageId !== 'string' ||
    !CALCULADORA_CUOTAS_IMAGE_ID_PATTERN.test(body.imageId) ||
    !isCalculadoraCuotasCalculationSource(body.calculationSource)
  ) {
    throw new BadRequestException({
      code: 'CALCULADORA_CUOTAS_USAGE_IMAGE_INVALID',
      message: 'La exportación requiere un identificador y origen de cálculo válidos.',
    });
  }
  return {
    eventId: body.eventId,
    visitId: body.visitId,
    eventName: body.eventName,
    imageId: body.imageId,
    calculationSource: body.calculationSource,
  };
}
