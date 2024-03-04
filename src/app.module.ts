import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { NewsModule } from './news/news.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [PrismaModule, NewsModule, UserModule],
})
export class AppModule {}
