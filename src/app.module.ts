import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { NewsModule } from './news/news.module';

@Module({
  imports: [PrismaModule, NewsModule],
})
export class AppModule {}
