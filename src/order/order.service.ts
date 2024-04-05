import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentService } from 'src/services/payment/payment.service';
import { CreatePaymentUrlRequest } from 'src/proto/payment_service.pb';
import { PageOptionsOrderDto } from './dto';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { OrderStatus } from '@prisma/client';
import { addMonths } from 'date-fns';

@Injectable()
export class OrderService {
  constructor(
    private prismaService: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}
  async create(createOrderDto: CreateOrderDto, ip: string, headers: any) {
    try {
      const packageIdentity = await this.prismaService.packages.findUnique({
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
      const order = await this.prismaService.orders.create({ data });
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

  async findAll(userId: number, dto: PageOptionsOrderDto) {
    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
      where: {
        userId,
      },
    };

    const pageOption =
      dto.page && dto.take
        ? {
            skip: dto.skip,
            take: dto.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.orders.findMany({
        include: {
          package: true,
        },
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.orders.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findOne(id: string) {
    const order = await this.prismaService.orders.findFirst({
      where: {
        id: id,
      },
      include: {
        package: true,
        user: {
          select: {
            id: true,
            email: true,
            image: true,
            name: true,
            role: true,
          },
        },
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
    try {
      const order = await this.prismaService.orders.update({
        where: {
          id: id,
        },
        data: {
          status: updateOrderDto.status,
        },
      });
      if (!order) {
        throw new NotFoundException({
          message: 'Order not found',
          data: null,
        });
      }
      return {
        ...order,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: error.message,
        data: null,
      });
    }
  }

  async updateFromPaymentService(id: string, updateOrderDto: UpdateOrderDto) {
    try {
      const order = await this.prismaService.orders.update({
        where: {
          id: id,
        },
        data: {
          status: updateOrderDto.status,
        },
      });
      if (!order) {
        throw new NotFoundException({
          message: 'Order not found',
          data: null,
        });
      }
      if (updateOrderDto.status == OrderStatus.completed) {
        const packageWithService = await this.prismaService.packages.findFirst({
          where: { id: order.packageId },
          include: {
            packageServices: {
              include: {
                service: true,
              },
            },
          },
        });
        const services = packageWithService.packageServices.map((value) => {
          const serviceConfig = JSON.parse(value.service.config);
          serviceConfig.used = 0;
          value.service.config = JSON.stringify(serviceConfig);
          return value.service;
        });

        await this.mongodbPrismaService.purchasedPackage.create({
          data: {
            expired: false,
            orderId: order.id,
            endDate: addMonths(Date.now(), packageWithService.duration),
            userId: order.userId,
            package: {
              id: packageWithService.id,
              name: packageWithService.name,
              price: packageWithService.price,
              duration: packageWithService.duration,
              images: packageWithService.images,
              createdAt: packageWithService.createdAt,
              updatedAt: packageWithService.updatedAt,
              services: services,
            },
          },
        });
      }
      return {
        ...order,
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: error.message,
        data: null,
      });
    }
  }

  async remove(id: string) {
    const order = await this.prismaService.orders.delete({
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
