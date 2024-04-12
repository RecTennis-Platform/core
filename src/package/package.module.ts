import { Module } from '@nestjs/common';
import { PackageService } from './package.service';
import {
  PackageController,
  SystemConfigController,
} from './package.controller';

@Module({
  controllers: [PackageController, SystemConfigController],
  providers: [PackageService],
})
export class PackageModule {}
