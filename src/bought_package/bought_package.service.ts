import { Injectable } from '@nestjs/common';
import { CreateBoughtPackageDto } from './dto/create-bought_package.dto';
import { UpdateBoughtPackageDto } from './dto/update-bought_package.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';

@Injectable()
export class BoughtPackageService {
  constructor(
    private prismaService: PrismaService,
    private readonly mongodbPrismaService: MongoDBPrismaService,
  ) {}
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

  async getUserBoughtPackages(userId: number) {
    const packages = await this.mongodbPrismaService.boughtPackage.findMany({
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
