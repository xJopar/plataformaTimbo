import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/meta-company-prisma/client';
import { resolveMetaCompanyDatabaseUrlFromEnvironment } from '../../runtime-config';

@Injectable()
export class MetaCompanyPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  public constructor() {
    super({
      adapter: new PrismaPg({ connectionString: resolveMetaCompanyDatabaseUrlFromEnvironment() }),
    });
  }
  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
