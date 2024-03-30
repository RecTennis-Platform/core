import { Injectable } from '@nestjs/common';
import { CreatePackagesServiceDto } from './dto/create-packages_service.dto';
import { UpdatePackagesServiceDto } from './dto/update-packages_service.dto';

@Injectable()
export class PackagesServicesService {
  create(createPackagesServiceDto: CreatePackagesServiceDto) {
    return 'This action adds a new packagesService';
  }

  findAll() {
    return `This action returns all packagesServices`;
  }

  findOne(id: number) {
    return `This action returns a #${id} packagesService`;
  }

  update(id: number, updatePackagesServiceDto: UpdatePackagesServiceDto) {
    return `This action updates a #${id} packagesService`;
  }

  remove(id: number) {
    return `This action removes a #${id} packagesService`;
  }
}
