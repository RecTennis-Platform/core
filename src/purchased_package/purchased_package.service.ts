import { Injectable } from '@nestjs/common';
import { CreatePurchasedPackageDto } from './dto/create-purchased_package.dto';
import { UpdatePurchasedPackageDto } from './dto/update-purchased_package.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MongoDBPrismaService } from 'src/prisma/prisma.mongo.service';
import { AdvertisementStatus, GroupTournamentStatus } from '@prisma/client';

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

  async getUserPurchasedPackages(userId: string) {
    const packages = await this.mongodbPrismaService.purchasedPackage.findMany({
      where: {
        userId: userId,
      },
    });

    return await Promise.all(
      packages.map(async (value) => {
        if (Date.now() >= value.endDate.getTime()) {
          value.expired = true;
        }
        return {
          id: value.id,
          userId: value.userId,
          expired: value.expired,
          orderId: value.orderId,
          startDate: value.startDate,
          endDate: value.endDate,
          name: value.package.name,
          services: await Promise.all(
            value.package.services.map(async (service) => {
              const { config, ...serviceInfo } = service;
              const configValue = JSON.parse(config);
              if (service.name.toLowerCase().includes('advertisement')) {
                configValue.used =
                  await this.prismaService.advertisements.count({
                    where: {
                      OR: [
                        {
                          status: AdvertisementStatus.approved,
                        },
                        {
                          status: AdvertisementStatus.pending,
                        },
                      ],
                      purchasedPackageId: value.id,
                    },
                  });
              }
              if (service.name.toLowerCase().includes('tournament basic')) {
                configValue.used =
                  await this.prismaService.group_tournaments.count({
                    where: {
                      NOT: {
                        status: GroupTournamentStatus.completed,
                      },
                      group: {
                        purchasedPackageId: value.id,
                      },
                    },
                  });
              }
              if (service.name.toLowerCase().includes('tournament advanced')) {
                configValue.used = await this.prismaService.tournaments.count({
                  where: {
                    NOT: {
                      status: GroupTournamentStatus.completed,
                    },
                    purchasedPackageId: value.id,
                  },
                });
              }
              if (service.name.toLowerCase().includes('group')) {
                configValue.used = await this.prismaService.groups.count({
                  where: {
                    purchasedPackageId: value.id,
                  },
                });
              }
              return {
                ...serviceInfo,
                config: configValue,
              };
            }),
          ),
        };
      }),
    );
  }
}
