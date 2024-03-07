import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { NewsModule } from './news/news.module';
import { UserModule } from './user/user.module';
import { MobileMiniAppModule } from './mobile_mini_app/mobile_mini_app.module';

@Module({
  imports: [PrismaModule, NewsModule, UserModule, MobileMiniAppModule],
})
export class AppModule {}
