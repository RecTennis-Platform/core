import { Module } from '@nestjs/common';
import { PurchasedPackageService } from './purchased_package.service';
import {
  MyPackageController,
  PurchasedPackageController,
} from './purchased_package.controller';

@Module({
  controllers: [PurchasedPackageController, MyPackageController],
  providers: [PurchasedPackageService],
})
export class PurchasedPackageModule {}
