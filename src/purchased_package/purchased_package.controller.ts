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
import { PurchasedPackageService } from './purchased_package.service';
import { CreatePurchasedPackageDto } from './dto/create-purchased_package.dto';
import { UpdatePurchasedPackageDto } from './dto/update-purchased_package.dto';
import { JwtGuard } from 'src/auth_utils/guards';
import { GetUser } from 'src/auth_utils/decorators';

@Controller('purchased-packages')
export class PurchasedPackageController {
  constructor(
    private readonly purchasedPackageService: PurchasedPackageService,
  ) {}

  @Post()
  create(@Body() createPurchasedPackageDto: CreatePurchasedPackageDto) {
    return this.purchasedPackageService.create(createPurchasedPackageDto);
  }

  @UseGuards(JwtGuard)
  @Get('/me')
  async addUserToGroup(@GetUser('sub') userId: number) {
    try {
      return await this.purchasedPackageService.getUserPurchasedPackages(
        userId,
      );
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
    return this.purchasedPackageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchasedPackageService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePurchasedPackageDto: UpdatePurchasedPackageDto,
  ) {
    return this.purchasedPackageService.update(+id, updatePurchasedPackageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchasedPackageService.remove(+id);
  }
}

@Controller('my-packages')
export class MyPackageController {
  constructor(
    private readonly purchasedPackageService: PurchasedPackageService,
  ) {}

  @UseGuards(JwtGuard)
  @Get('/')
  async addUserToGroup(@GetUser('sub') userId: number) {
    try {
      return await this.purchasedPackageService.getUserPurchasedPackages(
        userId,
      );
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
}
