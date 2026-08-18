import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Consulta el estado de disponibilidad de la API.',
  })
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'La API está disponible y responde correctamente.',
  })
  getHealth(): HealthResponseDto {
    return this.healthService.getHealth();
  }
}
