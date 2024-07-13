import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAdvertisementDto } from './dto/create-advertisement.dto';
import { UpdateAdvertisementDto } from './dto/update-advertisement.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { dot } from 'node:test/reporters';
import { AdvertisementStatus, UserRole } from '@prisma/client';
import { PageOptionsAdvertisementDto } from './dto/page-option-advertisements.dto';

@Injectable()
export class AdvertisementsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}

  private async checkPurchasePackage(purchasedPackageId: string) {
    const purchasedPackage =
      await this.mongodbPrismaService.purchasedPackage.findUnique({
        where: {
          id: purchasedPackageId,
        },
      });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Bought package not found',
        data: null,
      });
    }

    if (new Date(purchasedPackage.endDate) < new Date()) {
      throw new BadRequestException({
        message: 'Bought package is expired',
        data: null,
      });
    }

    return purchasedPackage;
  }

  private async checkValidAdvertisement(id: string) {
    const advertisement = await this.prismaService.advertisements.findUnique({
      where: {
        id: id,
      },
    });

    if (!advertisement) {
      throw new NotFoundException({
        message: 'Advertisement not found',
        data: null,
      });
    }

    const purchasedPackage = await this.checkPurchasePackage(
      advertisement.purchasedPackageId,
    );

    return { ...advertisement, purchasedPackage: purchasedPackage };
  }

  async create(userId: string, dto: CreateAdvertisementDto) {
    const purchasedPackage = await this.checkPurchasePackage(
      dto.purchasedPackageId,
    );

    // Check if the bought package have the service include "Group" word
    const adService = purchasedPackage.package.services.find((service) =>
      service.name.toLowerCase().includes('advertisement'),
    );

    if (!adService) {
      throw new BadRequestException({
        message:
          'This package does not have the service to create advertisement',
        data: null,
      });
    }

    if (purchasedPackage.userId != userId) {
      throw new BadRequestException({
        message: 'Permission Denied',
        data: null,
      });
    }
    const maxAds = JSON.parse(adService.config).maxAdvertisements;
    const count = await this.prismaService.advertisements.count({
      where: {
        purchasedPackageId: dto.purchasedPackageId,
        OR: [
          { status: AdvertisementStatus.approved },
          { status: AdvertisementStatus.pending },
        ],
      },
    });
    if (count >= maxAds) {
      throw new BadRequestException({
        message: 'Exceeded the allowed number of advertisements',
        data: null,
      });
    }

    //update purchased service
    const newServices = purchasedPackage.package.services.map((service) => {
      if (service.name.toLowerCase().includes('advertisement')) {
        const serviceConfig = JSON.parse(service.config);
        serviceConfig.used += 1;
        service.config = JSON.stringify(serviceConfig);
      }
      return service;
    });
    purchasedPackage.package.services = newServices;

    await this.mongodbPrismaService.purchasedPackage.update({
      where: {
        id: purchasedPackage.id,
      },
      data: {
        package: purchasedPackage.package,
      },
    });

    return await this.prismaService.advertisements.create({
      data: {
        content: dto.content,
        image: dto.image,
        purchasedPackageId: dto.purchasedPackageId,
        userId: userId,
        title: dto.title,
        website: dto.website,
      },
    });
  }

  async findAllByAdmin(pageOptions: PageOptionsAdvertisementDto) {
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        status: pageOptions.status,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get advertisements that are created by the user
    const [result, totalCount] = await Promise.all([
      this.prismaService.advertisements.findMany({
        ...conditions,
        ...pageOption,
        include: {
          user: {
            select: {
              id: true,
              image: true,
              name: true,
              email: true,
              gender: true,
              phoneNumber: true,
            },
          },
        },
      }),
      this.prismaService.advertisements.count(conditions),
    ]);
    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async findAllByOwner(
    userId: string,
    pageOptions: PageOptionsAdvertisementDto,
  ) {
    // Get user's purchased packages
    const purchasedPackages =
      await this.mongodbPrismaService.purchasedPackage.findMany({
        where: {
          userId: userId,
          endDate: {
            gt: new Date(), // Not expired purchased packages
          },
        },
      });

    // Get purchased packages that have the "advertisement" service
    const filteredPurchasedPackages = purchasedPackages.filter(
      (purchasedPackage) =>
        purchasedPackage.package.services.some(
          (service) =>
            service.name.toLowerCase().includes('advertisement') === true,
        ),
    );

    // Get purchased packages id
    const purchasedPackageIds = filteredPurchasedPackages.map(
      (purchasedPackage) => purchasedPackage.id,
    );

    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        purchasedPackageId: {
          in: purchasedPackageIds,
        },
      },
    };

    if (pageOptions.status) {
      conditions.where['status'] = pageOptions.status;
    }

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get advertisements that are created by the user
    const [result, totalCount] = await Promise.all([
      this.prismaService.advertisements.findMany({
        ...conditions,
        ...pageOption,
        include: {
          user: {
            select: {
              id: true,
              image: true,
              name: true,
              email: true,
              gender: true,
              phoneNumber: true,
            },
          },
        },
      }),
      this.prismaService.advertisements.count(conditions),
    ]);
    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async findAllByUser(pageOptions: PageOptionsAdvertisementDto) {
    const purchasedPackages =
      await this.mongodbPrismaService.purchasedPackage.findMany({
        where: {
          endDate: {
            gt: new Date(), // Not expired purchased packages
          },
        },
      });

    // Get purchased packages id
    const purchasedPackageIds = purchasedPackages.map(
      (purchasedPackage) => purchasedPackage.id,
    );

    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      where: {
        purchasedPackageId: {
          in: purchasedPackageIds,
        },
        status: AdvertisementStatus.approved,
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get advertisements that are created by the user
    const [result, totalCount] = await Promise.all([
      this.prismaService.advertisements.findMany({
        ...conditions,
        ...pageOption,
        include: {
          user: {
            select: {
              id: true,
              image: true,
              name: true,
              email: true,
              gender: true,
              phoneNumber: true,
            },
          },
        },
      }),
      this.prismaService.advertisements.count(conditions),
    ]);
    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async findOne(id: string) {
    return await this.prismaService.advertisements.findUnique({
      where: {
        id,
      },
      include: {
        user: {
          select: {
            id: true,
            image: true,
            name: true,
            email: true,
            gender: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  async updateByOwner(
    id: string,
    userId: string,
    updateAdvertisementDto: UpdateAdvertisementDto,
  ) {
    const ads = await this.checkValidAdvertisement(id);
    if (ads.purchasedPackage.userId != userId) {
      throw new BadRequestException({
        message: 'You are not allowed to access this resource',
        data: null,
      });
    }
    return await this.prismaService.advertisements.update({
      where: {
        id: id,
      },
      data: {
        content: updateAdvertisementDto.content,
        image: updateAdvertisementDto.image,
        title: updateAdvertisementDto.title,
        website: updateAdvertisementDto.website,
        status: AdvertisementStatus.pending,
      },
    });
  }

  async updateByAdmin(
    id: string,
    updateAdvertisementDto: UpdateAdvertisementDto,
  ) {
    return await this.prismaService.advertisements.update({
      where: {
        id: id,
      },
      data: {
        content: updateAdvertisementDto.content,
        image: updateAdvertisementDto.image,
        status: updateAdvertisementDto.status,
        title: updateAdvertisementDto.title,
        website: updateAdvertisementDto.website,
      },
    });
  }

  async remove(id: string, userId: string) {
    const ads = await this.checkValidAdvertisement(id);
    const user = await this.prismaService.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        role: true,
      },
    });
    if (ads.purchasedPackage.userId != userId && user.role != UserRole.admin) {
      throw new BadRequestException({
        message: 'You are not allowed to access this resource',
        data: null,
      });
    }
    return await this.prismaService.advertisements.delete({
      where: {
        id: id,
      },
    });
  }
}
