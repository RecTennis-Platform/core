import { Module } from '@nestjs/common';
import { PackagesServicesService } from './packages_services.service';
import { PackagesServicesController } from './packages_services.controller';

@Module({
  controllers: [PackagesServicesController],
  providers: [PackagesServicesService],
})
export class PackagesServicesModule {}
