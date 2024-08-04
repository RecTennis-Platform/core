import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateOrderDto,
  RenewOrderDto,
  UpgradeOrderDto,
} from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentService } from 'src/services/payment/payment.service';
import { CreatePaymentUrlRequest } from 'src/proto/payment_service.pb';
import { PageOptionsOrderDto, StatisticOrderDto } from './dto';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { OrderStatus, UserRole } from '@prisma/client';
import { addMonths } from 'date-fns';
import { PackageService } from 'src/package/package.service';

@Injectable()
export class OrderService {
  constructor(
    private prismaService: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly packageService: PackageService,
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
        partner: createOrderDto.partner,
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

  async upgrade(
    dto: UpgradeOrderDto,
    ip: string,
    headers: any,
    userId: string,
  ) {
    try {
      const purchasedPackage =
        await this.mongodbPrismaService.purchasedPackage.findUnique({
          where: {
            id: dto.purchasedPackageId,
          },
        });
      if (!purchasedPackage) {
        throw new NotFoundException({
          message: 'Purchased Package not found',
          data: null,
        });
      }
      if (purchasedPackage.userId != userId) {
        throw new BadRequestException({
          message: 'Access Denied',
          data: null,
        });
      }
      const updatedOrder = await this.prismaService.orders.findFirst({
        where: {
          id: purchasedPackage.orderId,
        },
        include: {
          package: true,
        },
      });
      if (!updatedOrder) {
        throw new NotFoundException({
          message: 'Order not found',
          data: null,
        });
      }
      const childrenPackages =
        await this.packageService.getAllParentsAndChildren(dto.packageId);
      const childrenPackagesIds = childrenPackages.map(
        (cpackage) => cpackage.id,
      );

      if (!childrenPackagesIds.includes(updatedOrder.package.id)) {
        throw new BadRequestException({
          message: 'Cannot upgrade to this package',
          data: null,
        });
      }
      const parentPackage = await this.prismaService.packages.findFirst({
        where: {
          id: dto.packageId,
        },
      });
      const price = parentPackage.price;
      const packageId = parentPackage.id;
      const order = await this.prismaService.orders.create({
        data: {
          userId: userId,
          packageId,
          price,
          partner: dto.partner,
          type: dto.type,
          referenceId: updatedOrder.id,
        },
      });
      const returnUrl = headers?.ismobile
        ? process.env.RETURN_URL_PAYMENT_FOR_MOBILE
        : process.env.RETURN_URL_PAYMENT_FOR_WEB;
      const paymentDto: CreatePaymentUrlRequest = {
        amount: order.price,
        locale: 'vi',
        orderId: order.id,
        partner: dto.partner,
        clientIp: ip,
        returnUrl: returnUrl,
      };
      const payment = await this.paymentService.createPayment(paymentDto);
      return { order, payment: payment?.data };
    } catch (error) {
      throw error;
    }
  }

  async renew(dto: RenewOrderDto, ip: string, headers: any, userId: string) {
    try {
      const purchasedPackage =
        await this.mongodbPrismaService.purchasedPackage.findUnique({
          where: {
            id: dto.purchasedPackageId,
          },
        });
      if (!purchasedPackage) {
        throw new NotFoundException({
          message: 'Purchased Package not found',
          data: null,
        });
      }
      if (purchasedPackage.userId != userId) {
        throw new BadRequestException({
          message: 'Access Denied',
          data: null,
        });
      }
      const updatedOrder = await this.prismaService.orders.findFirst({
        where: {
          id: purchasedPackage.orderId,
        },
        include: {
          package: true,
        },
      });
      if (!updatedOrder) {
        throw new NotFoundException({
          message: 'Order not found',
          data: null,
        });
      }

      // if (!updatedOrder.package.parentId && dto.type === 'upgrade') {
      //   throw new BadRequestException({
      //     message: 'This package cannot upgrade',
      //     data: null,
      //   });
      // }
      const price = updatedOrder.package.price;
      const packageId = updatedOrder.package.id;
      const order = await this.prismaService.orders.create({
        data: {
          userId: userId,
          packageId,
          price,
          partner: dto.partner,
          type: dto.type,
          referenceId: updatedOrder.id,
        },
      });
      const returnUrl = headers?.ismobile
        ? process.env.RETURN_URL_PAYMENT_FOR_MOBILE
        : process.env.RETURN_URL_PAYMENT_FOR_WEB;
      const paymentDto: CreatePaymentUrlRequest = {
        amount: order.price,
        locale: 'vi',
        orderId: order.id,
        partner: dto.partner,
        clientIp: ip,
        returnUrl: returnUrl,
      };
      const payment = await this.paymentService.createPayment(paymentDto);
      return { order, payment: payment?.data };
    } catch (error) {
      throw error;
    }
  }

  async findAll(userId: string, dto: PageOptionsOrderDto) {
    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
      where: {
        userId,
        status: dto?.status,
        NOT: {
          status: 'new',
        },
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
        //...conditions,
        orderBy: [
          {
            createdAt: dto.order,
          },
        ],
        where: {
          userId,
          status: dto?.status,
          NOT: {
            status: OrderStatus.new,
          },
        },
        ...pageOption,
      }),
      this.prismaService.orders.count({
        where: {
          userId,
          status: dto?.status,
          NOT: {
            status: OrderStatus.new,
          },
        },
      }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findAllByAdmin(dto: PageOptionsOrderDto) {
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
          user: true,
        },
        //...conditions,
        orderBy: [
          {
            createdAt: dto.order,
          },
        ],
        where: {
          status: dto?.status,
          userId: dto?.userId,
        },
        ...pageOption,
      }),
      this.prismaService.orders.count({
        where: {
          status: dto?.status,
          userId: dto?.userId,
        },
      }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findOne(id: string, userId: string) {
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
            phoneNumber: true,
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
    const user = await this.prismaService.users.findFirst({
      where: {
        id: userId,
      },
    });
    if (order.userId != userId && user.role != UserRole.admin) {
      throw new ForbiddenException({
        message: 'Permission denied',
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
      const order = await this.prismaService.orders.findFirst({
        where: {
          id: id,
        },
        include: {
          package: true,
        },
      });
      if (!order) {
        throw new NotFoundException({
          message: 'Order not found',
          data: null,
        });
      }
      if (
        order.package.type === 'renew' &&
        updateOrderDto.status == OrderStatus.completed
      ) {
        const purchasedPackage =
          await this.mongodbPrismaService.purchasedPackage.findFirst({
            where: {
              orderId: order.referenceId,
            },
          });
        if (!purchasedPackage) {
          throw new NotFoundException({
            message: 'Purchased Package not found',
            data: null,
          });
        }
        await this.mongodbPrismaService.purchasedPackage.updateMany({
          where: {
            orderId: order.referenceId,
          },
          data: {
            orderId: order.id,
            endDate: addMonths(
              purchasedPackage.endDate,
              order.package.duration,
            ),
          },
        });
      }
      if (
        updateOrderDto.status == OrderStatus.completed &&
        order.type === 'create'
      ) {
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

      if (
        updateOrderDto.status == OrderStatus.completed &&
        order.type === 'upgrade'
      ) {
        const purchasedPackage =
          await this.mongodbPrismaService.purchasedPackage.findFirst({
            where: {
              orderId: order.referenceId,
            },
          });
        if (!purchasedPackage) {
          throw new NotFoundException({
            message: 'Purchased Package not found',
            data: null,
          });
        }
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

        await this.mongodbPrismaService.purchasedPackage.updateMany({
          where: {
            orderId: order.referenceId,
          },
          data: {
            expired: false,
            endDate: addMonths(
              purchasedPackage.endDate,
              packageWithService.duration,
            ),
            userId: order.userId,
            orderId: order.id,
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
      const updatedOrder = await this.prismaService.orders.update({
        where: {
          id: id,
        },
        data: {
          status: updateOrderDto.status,
        },
      });
      return {
        ...updatedOrder,
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

  async getStatistic(dto: StatisticOrderDto) {
    // Calculate the start and end of the year
    const year = dto.year;
    const startDate = year ? new Date(`${year}-01-01T00:00:00Z`) : undefined;
    const endDate = year ? new Date(`${year + 1}-01-01T00:00:00Z`) : undefined;
    const orders = await this.prismaService.orders.findMany({
      include: {
        package: true,
      },
      where: {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lt: endDate }),
        },
      },
    });
    if (dto.time === 'month' && dto.year) {
      return await this.getMonthlyOrderData(orders);
    } else if (dto.time === 'quarter' && dto.year) {
      return await this.getQuarterlyOrderData(orders);
    } else if (dto.time === 'year' && !dto.year) {
      return await this.getYearlyOrderData(orders);
    }
  }

  async getMonthlyOrderData(orders: any) {
    const monthlySums = {
      Tournament: Array(12).fill(0),
      Affiliate: Array(12).fill(0),
      Group: Array(12).fill(0),
    };

    // Helper function to get the month index (0-based)
    const getMonthIndex = (date) => date.getMonth(); // 0 for Jan, 1 for Feb, etc.

    // Calculate monthly sums
    orders.forEach((order) => {
      const monthIndex = getMonthIndex(order.createdAt);
      switch (order.package.type) {
        case 'tournament':
          monthlySums.Tournament[monthIndex] += order.price;
          break;
        case 'affiliate':
          monthlySums.Affiliate[monthIndex] += order.price;
          break;
        case 'group':
          monthlySums.Group[monthIndex] += order.price;
          break;
      }
    });

    const totalOrderSum = await this.prismaService.orders.aggregate({
      _sum: {
        price: true,
      },
    });
    const orderSumByYear = orders.reduce((sum, order) => sum + order.price, 0);

    // Prepare the data format
    const transformedData = {
      orderSum: totalOrderSum._sum.price,
      orderSumByYear: orderSumByYear,
      categories: [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ],
      series: [
        {
          name: 'Tournament',
          data: monthlySums.Tournament,
        },
        {
          name: 'Group',
          data: monthlySums.Group,
        },
        {
          name: 'Affiliate',
          data: monthlySums.Affiliate,
        },
      ],
    };

    return transformedData;
  }

  async getQuarterlyOrderData(orders: any) {
    // Initialize arrays to hold sums for each type
    const quarterlySums = {
      Tournament: Array(4).fill(0),
      Affiliate: Array(4).fill(0),
      Group: Array(4).fill(0),
    };

    // Helper function to get the quarter index (0-based)
    const getQuarterIndex = (date) => {
      const month = date.getMonth();
      return Math.floor(month / 3); // 0 for Q1 (Jan-Mar), 1 for Q2 (Apr-Jun), etc.
    };

    // Calculate quarterly sums
    orders.forEach((order) => {
      const quarterIndex = getQuarterIndex(order.createdAt);
      switch (order.package.type) {
        case 'tournament':
          quarterlySums.Tournament[quarterIndex] += order.price;
          break;
        case 'affiliate':
          quarterlySums.Affiliate[quarterIndex] += order.price;
          break;
        case 'group':
          quarterlySums.Group[quarterIndex] += order.price;
          break;
      }
    });

    const totalOrderSum = await this.prismaService.orders.aggregate({
      _sum: {
        price: true,
      },
    });
    const orderSumByYear = orders.reduce((sum, order) => sum + order.price, 0);

    // Prepare the data format
    const transformedData = {
      orderSum: totalOrderSum._sum.price,
      orderSumByYear: orderSumByYear,
      categories: ['Q1', 'Q2', 'Q3', 'Q4'], // Categories for quarters
      series: [
        {
          name: 'Tournament',
          data: quarterlySums.Tournament,
        },
        {
          name: 'Group',
          data: quarterlySums.Group,
        },
        {
          name: 'Affiliate',
          data: quarterlySums.Affiliate,
        },
      ],
    };

    return transformedData;
  }

  async getYearlyOrderData(orders: any) {
    const yearlyData: {
      [year: number]: { tournament: number; affiliate: number; group: number };
    } = {};

    // Process each order to group by year
    orders.forEach((order) => {
      const year = order.createdAt.getFullYear();
      const type = order.package.type as 'tournament' | 'affiliate' | 'group'; // Explicitly cast type

      // Initialize data structures if not already present
      if (!yearlyData[year]) {
        yearlyData[year] = {
          tournament: 0,
          affiliate: 0,
          group: 0,
        };
      }

      // Update yearly sums
      yearlyData[year][type] += order.price;
    });

    // Compute total order sum and sum by year
    const totalOrderSum = Object.values(yearlyData).reduce(
      (sum, yearly) =>
        sum + Object.values(yearly).reduce((acc, price) => acc + price, 0),
      0,
    );

    // const orderSumByYear = Object.keys(yearlyData).map((year) => ({
    //   year: parseInt(year, 10),
    //   total: Object.values(yearlyData[parseInt(year, 10)]).reduce(
    //     (sum, price) => sum + price,
    //     0,
    //   ),
    // }));
    const orderSumByYear = totalOrderSum;

    // Prepare the data format
    const transformedData = {
      orderSum: totalOrderSum,
      orderSumByYear,
      categories: Object.keys(yearlyData).sort(), // Sorted years as categories
      series: [
        {
          name: 'Tournament',
          data: Object.keys(yearlyData).map(
            (year) => yearlyData[parseInt(year, 10)].tournament,
          ),
        },
        {
          name: 'Group',
          data: Object.keys(yearlyData).map(
            (year) => yearlyData[parseInt(year, 10)].group,
          ),
        },
        {
          name: 'Affiliate',
          data: Object.keys(yearlyData).map(
            (year) => yearlyData[parseInt(year, 10)].affiliate,
          ),
        },
      ],
    };

    return transformedData;
  }
}
