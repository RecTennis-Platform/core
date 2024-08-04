import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  Headers,
  UseGuards,
  Query,
} from '@nestjs/common';
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  CreateOrderEnum,
  RenewOrderDto,
  UpgradeOrderDto,
} from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Ip } from '@nestjs/common';
import { JwtGuard, RolesGuard } from 'src/auth_utils/guards';
import { PageOptionsOrderDto, StatisticOrderDto } from './dto';
import { GetUser, Roles } from 'src/auth_utils/decorators';

import { UserRole } from '@prisma/client';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtGuard)
  @Post()
  async create(
    @GetUser('sub') userId: string,
    @Body() createOrderDto: CreateOrderDto,
    @Ip() ip,
    @Headers() headers,
  ) {
    try {
      createOrderDto.userId = userId;
      return this.orderService.create(createOrderDto, ip, headers);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtGuard)
  @Post('purchased-packages/upgrade')
  async upgrade(
    @GetUser('sub') userId: string,
    @Body() dto: UpgradeOrderDto,
    @Ip() ip,
    @Headers() headers,
  ) {
    try {
      dto.type = CreateOrderEnum.upgrade;
      return this.orderService.upgrade(dto, ip, headers, userId);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtGuard)
  @Post('purchased-packages/renew')
  async renew(
    @GetUser('sub') userId: string,
    @Body() dto: RenewOrderDto,
    @Ip() ip,
    @Headers() headers,
  ) {
    try {
      dto.type = CreateOrderEnum.renew;
      return this.orderService.renew(dto, ip, headers, userId);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtGuard)
  @Get()
  async findAll(
    @GetUser('sub') userId: string,
    @Query() dto: PageOptionsOrderDto,
  ) {
    try {
      return this.orderService.findAll(userId, dto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('statistic')
  async getStatistic(@Query() dto: StatisticOrderDto) {
    try {
      return this.orderService.getStatistic(dto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('admin')
  async findAllByAdmin(@Query() dto: PageOptionsOrderDto) {
    try {
      return this.orderService.findAllByAdmin(dto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @GetUser('sub') userId: string) {
    try {
      return this.orderService.findOne(id, userId);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    try {
      return this.orderService.update(id, updateOrderDto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/payment')
  async updateFromPaymentService(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    try {
      return this.orderService.updateFromPaymentService(id, updateOrderDto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return this.orderService.remove(id);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
