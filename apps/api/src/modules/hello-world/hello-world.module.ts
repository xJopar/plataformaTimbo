import { Module } from '@nestjs/common';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { AuthModule } from '../auth/auth.module';
import { HelloWorldApplicationAccessGuard } from './hello-world-application-access.guard';
import { HelloWorldController } from './hello-world.controller';
import { HelloWorldService } from './hello-world.service';
import { HELLO_WORLD_FETCH } from './hello-world.tokens';

@Module({
  imports: [AuthModule, AccessProfilesModule],
  controllers: [HelloWorldController],
  providers: [
    HelloWorldApplicationAccessGuard,
    HelloWorldService,
    { provide: HELLO_WORLD_FETCH, useValue: fetch },
  ],
})
export class HelloWorldModule {}
