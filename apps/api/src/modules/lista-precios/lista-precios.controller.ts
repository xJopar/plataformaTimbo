import { BadGatewayException, Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthenticationGuard } from '../auth/session-authentication.guard';
import { toVehicleResponse, VehicleResponseDto } from './dto/vehicle-response.dto';
import { ListaPreciosApplicationAccessGuard } from './lista-precios-application-access.guard';
import { ListaPreciosProviderUnavailableError } from './lista-precios.errors';
import { ListaPreciosService } from './lista-precios.service';

@ApiTags('applications')
@Controller('applications/lista-precios')
@UseGuards(SessionAuthenticationGuard, ListaPreciosApplicationAccessGuard)
export class ListaPreciosController {
  public constructor(private readonly listaPreciosService: ListaPreciosService) {}

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
}
