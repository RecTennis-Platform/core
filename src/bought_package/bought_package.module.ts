import { Module } from '@nestjs/common';
import { BoughtPackageService } from './bought_package.service';
import { BoughtPackageController } from './bought_package.controller';

@Module({
  controllers: [BoughtPackageController],
  providers: [BoughtPackageService],
})
export class BoughtPackageModule {}
