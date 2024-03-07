import { Module } from '@nestjs/common';
import { MobileMiniAppController } from './mobile_mini_app.controller';
import { MobileMiniAppService } from './mobile_mini_app.service';

@Module({
  controllers: [MobileMiniAppController],
  providers: [MobileMiniAppService],
})
export class MobileMiniAppModule {}
