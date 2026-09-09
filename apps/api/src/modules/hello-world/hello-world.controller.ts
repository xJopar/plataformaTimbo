import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from '../auth/session-authentication.guard';
import { CsrfProtectionGuard } from '../auth/csrf-protection.guard';
import { UsageEventsService } from '../usage-events/usage-events.service';
import { HelloWorldJokeRequestDto } from './dto/hello-world-joke-request.dto';
import {
  HelloWorldJokeResponseDto,
  toHelloWorldJokeResponse,
} from './dto/hello-world-joke-response.dto';
import { HelloWorldApplicationAccessGuard } from './hello-world-application-access.guard';
import { HelloWorldProviderUnavailableError } from './hello-world.errors';
import { HelloWorldService } from './hello-world.service';

@ApiTags('applications')
@Controller('applications/hello-world')
@UseGuards(SessionAuthenticationGuard, HelloWorldApplicationAccessGuard)
export class HelloWorldController {
  public constructor(
    private readonly helloWorldService: HelloWorldService,
    private readonly usageEventsService: UsageEventsService,
  ) {}

  @Post('joke')
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({
    operationId: 'requestHelloWorldJoke',
    summary: 'Registra la solicitud y obtiene un chiste en inglés para Hello World.',
  })
  @ApiOkResponse({ type: HelloWorldJokeResponseDto })
  @ApiBadGatewayResponse({ description: 'El proveedor de chistes no está disponible.' })
  public async getJoke(
    @Body() body: HelloWorldJokeRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<HelloWorldJokeResponseDto> {
    const authenticatedUser = request.authenticatedUser;
    if (authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    assertUsageIdentifiers(body);

    // La medición no condiciona la acción principal: UsageEventsService diagnostica un fallo de
    // persistencia y devuelve `failed`, mientras que el usuario aún puede recibir su chiste.
    await this.usageEventsService.append({
      eventId: body.eventId,
      actorUserId: authenticatedUser.id,
      eventName: 'hello-world.joke_requested',
      visitId: body.visitId,
    });

    try {
      return toHelloWorldJokeResponse(await this.helloWorldService.getJoke());
    } catch (error) {
      if (error instanceof HelloWorldProviderUnavailableError) {
        throw new BadGatewayException(
          {
            code: 'HELLO_WORLD_UNAVAILABLE',
            message: 'No pudimos obtener el chiste. Intentá nuevamente.',
          },
          { cause: error },
        );
      }
      throw error;
    }
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function assertUsageIdentifiers(body: HelloWorldJokeRequestDto): void {
  if (!UUID_PATTERN.test(body.eventId) || !UUID_PATTERN.test(body.visitId)) {
    throw new BadRequestException({
      code: 'HELLO_WORLD_USAGE_IDENTIFIERS_INVALID',
      message: 'Los identificadores de uso deben ser UUID válidos.',
    });
  }
}
