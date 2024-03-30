import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PackagesServicesService } from './packages_services.service';
import { CreatePackagesServiceDto } from './dto/create-packages_service.dto';
import { UpdatePackagesServiceDto } from './dto/update-packages_service.dto';

@Controller('packages-services')
export class PackagesServicesController {
  constructor(private readonly packagesServicesService: PackagesServicesService) {}

  @Post()
  create(@Body() createPackagesServiceDto: CreatePackagesServiceDto) {
    return this.packagesServicesService.create(createPackagesServiceDto);
  }

  @Get()
  findAll() {
    return this.packagesServicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesServicesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePackagesServiceDto: UpdatePackagesServiceDto) {
    return this.packagesServicesService.update(+id, updatePackagesServiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.packagesServicesService.remove(+id);
  }
}
