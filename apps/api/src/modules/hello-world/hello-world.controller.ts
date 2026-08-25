import { BadGatewayException, Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthenticationGuard } from '../auth/session-authentication.guard';
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
  public constructor(private readonly helloWorldService: HelloWorldService) {}

  @Get('joke')
  @ApiOperation({
    operationId: 'getHelloWorldJoke',
    summary: 'Obtiene un chiste en inglés y su traducción al español.',
  })
  @ApiOkResponse({ type: HelloWorldJokeResponseDto })
  @ApiBadGatewayResponse({ description: 'Uno de los proveedores externos no está disponible.' })
  public async getJoke(): Promise<HelloWorldJokeResponseDto> {
    try {
      return toHelloWorldJokeResponse(await this.helloWorldService.getTranslatedJoke());
    } catch (error) {
      if (error instanceof HelloWorldProviderUnavailableError) {
        throw new BadGatewayException(
          {
            code: 'HELLO_WORLD_UNAVAILABLE',
            message: 'No pudimos obtener y traducir el chiste. Intentá nuevamente.',
          },
          { cause: error },
        );
      }
      throw error;
    }
  }
}
