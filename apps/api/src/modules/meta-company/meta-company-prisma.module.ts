import { Module } from '@nestjs/common';
import { MetaCompanyPrismaService } from './meta-company-prisma.service';
@Module({ providers: [MetaCompanyPrismaService], exports: [MetaCompanyPrismaService] })
export class MetaCompanyPrismaModule {}
