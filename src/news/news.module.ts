import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { JwtStrategy } from 'src/auth_utils/strategy';

@Module({
  providers: [NewsService, JwtStrategy],
  controllers: [NewsController],
})
export class NewsModule {}
