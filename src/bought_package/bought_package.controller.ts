import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BoughtPackageService } from './bought_package.service';
import { CreateBoughtPackageDto } from './dto/create-bought_package.dto';
import { UpdateBoughtPackageDto } from './dto/update-bought_package.dto';
import { JwtGuard } from 'src/auth_utils/guards';
import { GetUser } from 'src/auth_utils/decorators';

@Controller('bought-packages')
export class BoughtPackageController {
  constructor(private readonly boughtPackageService: BoughtPackageService) {}

  @Post()
  create(@Body() createBoughtPackageDto: CreateBoughtPackageDto) {
    return this.boughtPackageService.create(createBoughtPackageDto);
  }

  @UseGuards(JwtGuard)
  @Get('/me')
  async addUserToGroup(@GetUser('sub') userId: number) {
    try {
      return await this.boughtPackageService.getUserBoughtPackages(userId);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
  update(
    @Param('id') id: string,
    @Body() updateBoughtPackageDto: UpdateBoughtPackageDto,
  ) {
    return this.boughtPackageService.update(+id, updateBoughtPackageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.boughtPackageService.remove(+id);
  }
}
