import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CorePrismaService } from 'src/prisma/prisma_core.service';
import { PaymentService } from 'src/services/payment/payment.service';
import { CreatePaymentUrlRequest } from 'src/proto/payment_service.pb';

@Injectable()
export class OrderService {
  constructor(
    private corePrismaService: CorePrismaService,
    private readonly paymentService: PaymentService,
  ) {}
  async create(createOrderDto: CreateOrderDto, ip: string, headers: any) {
    try {
      const packageIdentity = await this.corePrismaService.packages.findUnique({
        where: {
          id: createOrderDto.packageId,
        },
      });
      if (!packageIdentity) {
        throw new NotFoundException({
          message: 'Package not found',
          data: null,
        });
      }
      const data = {
        userId: createOrderDto.userId,
        groupId: createOrderDto.groupId,
        packageId: createOrderDto.packageId,
        price: packageIdentity.price,
      };
      const order = await this.corePrismaService.orders.create({ data });
      const returnUrl = headers?.ismobile
        ? process.env.RETURN_URL_PAYMENT_FOR_MOBILE
        : process.env.RETURN_URL_PAYMENT_FOR_WEB;
      const paymentDto: CreatePaymentUrlRequest = {
        amount: order.price,
        locale: 'vi',
        orderId: order.id,
        partner: createOrderDto.partner,
        clientIp: ip,
        returnUrl: returnUrl,
      };
      const payment = await this.paymentService.createPayment(paymentDto);
      return { order, payment: payment?.data };
    } catch (error) {
      throw error;
    }
  }

  findAll() {
    return `This action returns all order`;
  }

  async findOne(id: string) {
    const order = await this.corePrismaService.orders.findFirst({
      where: {
        id: id,
      },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        data: null,
      });
    }
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.corePrismaService.orders.update({
      where: {
        id: id,
      },
      data: {
        status: updateOrderDto.status,
        groupId: updateOrderDto.groupId,
      },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        data: null,
      });
    }
  }

  async remove(id: string) {
    const order = await this.corePrismaService.orders.delete({
      where: {
        id: id,
      },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Order not found',
        data: null,
      });
    }
  }
}
