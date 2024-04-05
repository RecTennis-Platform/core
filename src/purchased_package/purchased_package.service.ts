import { Injectable } from '@nestjs/common';
import { CreatePurchasedPackageDto } from './dto/create-purchased_package.dto';
import { UpdatePurchasedPackageDto } from './dto/update-purchased_package.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';

@Injectable()
export class PurchasedPackageService {
  constructor(
    private prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}
  create(createPurchasedPackageDto: CreatePurchasedPackageDto) {
    return 'This action adds a new PurchasedPackage';
  }

  findAll() {
    return `This action returns all PurchasedPackage`;
  }

  findOne(id: number) {
    return `This action returns a #${id} PurchasedPackage`;
  }

  update(id: number, updatePurchasedPackageDto: UpdatePurchasedPackageDto) {
    return `This action updates a #${id} PurchasedPackage`;
  }

  remove(id: number) {
    return `This action removes a #${id} PurchasedPackage`;
  }

  async getUserPurchasedPackages(userId: number) {
    const packages = await this.mongodbPrismaService.purchasedPackage.findMany({
      where: {
        userId: userId,
      },
    });

    return packages.map((value) => {
      return {
        id: value.id,
        userId: value.userId,
        expired: value.expired,
        orderId: value.orderId,
        startDate: value.startDate,
        endDate: value.endDate,
        name: value.package.name,
        services: value.package.services.map((service) => {
          const { config, ...serviceInfo } = service;
          const configValue = JSON.parse(config);
          return {
            ...serviceInfo,
            ...configValue,
          };
        }),
      };
    });
  }
}
