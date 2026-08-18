import { Injectable } from '@nestjs/common';
import { HealthResponseDto } from './dto/health-response.dto';

const HEALTHY_STATUS = 'ok';

@Injectable()
export class HealthService {
  getHealth(): HealthResponseDto {
    return {
      status: HEALTHY_STATUS,
      timestamp: new Date().toISOString(),
    };
  }
}
