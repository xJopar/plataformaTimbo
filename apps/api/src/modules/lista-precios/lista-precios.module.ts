import { Module } from '@nestjs/common';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuthModule } from '../auth/auth.module';
import { UsageEventsModule } from '../usage-events/usage-events.module';
import { ListaPreciosApplicationAccessGuard } from './lista-precios-application-access.guard';
import { ListaPreciosController } from './lista-precios.controller';
import { ListaPreciosService } from './lista-precios.service';
import { LISTA_PRECIOS_FETCH } from './lista-precios.tokens';

@Module({
  imports: [AuthModule, AccessProfilesModule, UsageEventsModule],
  controllers: [ListaPreciosController],
  providers: [
    ListaPreciosApplicationAccessGuard,
    ListaPreciosService,
    { provide: LISTA_PRECIOS_FETCH, useValue: fetch },
  ],
})
export class ListaPreciosModule {}
