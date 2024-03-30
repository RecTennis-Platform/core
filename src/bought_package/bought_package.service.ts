import { Injectable } from '@nestjs/common';
import { CreateBoughtPackageDto } from './dto/create-bought_package.dto';
import { UpdateBoughtPackageDto } from './dto/update-bought_package.dto';

@Injectable()
export class BoughtPackageService {
  create(createBoughtPackageDto: CreateBoughtPackageDto) {
    return 'This action adds a new boughtPackage';
  }

  findAll() {
    return `This action returns all boughtPackage`;
  }

  findOne(id: number) {
    return `This action returns a #${id} boughtPackage`;
  }

  update(id: number, updateBoughtPackageDto: UpdateBoughtPackageDto) {
    return `This action updates a #${id} boughtPackage`;
  }

  remove(id: number) {
    return `This action removes a #${id} boughtPackage`;
  }
}
