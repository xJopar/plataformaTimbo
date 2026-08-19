import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { OAuthLoginAttemptsService } from './oauth-login-attempts.service';
import { UserSessionsService } from './user-sessions.service';

@Module({
  imports: [PrismaModule],
  providers: [OAuthLoginAttemptsService, UserSessionsService],
  exports: [OAuthLoginAttemptsService, UserSessionsService],
})
export class AuthModule {}
