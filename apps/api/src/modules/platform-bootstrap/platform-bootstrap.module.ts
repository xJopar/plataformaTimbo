import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administration/administration.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformBootstrapController } from './platform-bootstrap.controller';
import { PlatformBootstrapService } from './platform-bootstrap.service';

@Module({
  imports: [AuthModule, AdministrationModule],
  controllers: [PlatformBootstrapController],
  providers: [PlatformBootstrapService],
})
export class PlatformBootstrapModule {}
