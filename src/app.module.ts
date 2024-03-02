import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { NewsModule } from './news/news.module';
import { AffiliateModule } from './affiliate/affiliate.module';

@Module({
  imports: [PrismaModule, NewsModule, AffiliateModule],
})
export class AppModule {}
