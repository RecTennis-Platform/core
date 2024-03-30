import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BoughtPackageService } from './bought_package.service';
import { CreateBoughtPackageDto } from './dto/create-bought_package.dto';
import { UpdateBoughtPackageDto } from './dto/update-bought_package.dto';

@Controller('bought-package')
export class BoughtPackageController {
  constructor(private readonly boughtPackageService: BoughtPackageService) {}

  @Post()
  create(@Body() createBoughtPackageDto: CreateBoughtPackageDto) {
    return this.boughtPackageService.create(createBoughtPackageDto);
  }

  @Get()
  findAll() {
    return this.boughtPackageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boughtPackageService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBoughtPackageDto: UpdateBoughtPackageDto) {
    return this.boughtPackageService.update(+id, updateBoughtPackageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.boughtPackageService.remove(+id);
  }
}
