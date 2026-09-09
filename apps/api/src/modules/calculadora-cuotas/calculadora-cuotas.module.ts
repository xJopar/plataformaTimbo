import { Module } from '@nestjs/common';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuthModule } from '../auth/auth.module';
import { UsageEventsModule } from '../usage-events/usage-events.module';
import { CalculadoraCuotasApplicationAccessGuard } from './calculadora-cuotas-application-access.guard';
import { CalculadoraCuotasController } from './calculadora-cuotas.controller';

@Module({
  imports: [AuthModule, AccessProfilesModule, UsageEventsModule],
  controllers: [CalculadoraCuotasController],
  providers: [CalculadoraCuotasApplicationAccessGuard],
})
export class CalculadoraCuotasModule {}
