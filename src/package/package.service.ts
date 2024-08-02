import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PageOptionsPackageDto } from './dto/page-options-package.dto';

@Injectable()
export class PackageService {
  constructor(private prismaService: PrismaService) {}
  async create(createPackageDto: CreatePackageDto) {
    return await this.prismaService.$transaction(async (tx) => {
      const packaged = await tx.packages.create({
        data: {
          name: createPackageDto.name,
          price: createPackageDto.price,
          duration: createPackageDto.duration,
          description: createPackageDto.description,
          features: createPackageDto.features,
          images: createPackageDto.images,
        },
      });

      const packageServicesData = createPackageDto.services.map((service) => {
        return { serviceId: service, packageId: packaged.id };
      });
      await tx.packages_services.createMany({
        data: packageServicesData,
        skipDuplicates: true,
      });
      return packaged;
    });
  }

  async findAll(dto: PageOptionsPackageDto) {
    const packageList = await this.prismaService.packages.findMany({
      include: {
        packageServices: {
          include: {
            service: true,
          },
        },
      },
      where: {
        packageServices: {
          some: {
            service: {
              type: dto.type,
            },
          },
        },
      },
    });
    return packageList.map((p) => {
      const { packageServices, ...packageData } = p;
      const services = packageServices.map((value) => {
        const { config, ...serviceInfo } = value.service;
        const configValue = JSON.parse(config);
        return {
          ...serviceInfo,
          config: configValue,
        };
      });
      return { ...packageData, services };
    });
  }

  async findAllAdmin(pageOptions: PageOptionsPackageDto) {
    // Build pagination options
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptions.order,
        },
      ],
      include: {
        packageServices: {
          include: {
            service: true,
          },
        },
      },
      where: {
        packageServices: {
          some: {
            service: {
              type: pageOptions.type,
            },
          },
        },
      },
    };

    const pageOption =
      pageOptions.page && pageOptions.take
        ? {
            skip: pageOptions.skip,
            take: pageOptions.take,
          }
        : undefined;

    // Get referee's matches
    const [result, totalCount] = await Promise.all([
      this.prismaService.packages.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.packages.count({
        where: conditions.where,
      }),
    ]);

    return {
      data: result.map((p) => {
        const { packageServices, ...packageData } = p;
        const services = packageServices.map((value) => {
          const { config, ...serviceInfo } = value.service;
          const configValue = JSON.parse(config);
          return {
            ...serviceInfo,
            config: configValue,
          };
        });
        return { ...packageData, services };
      }),
      totalPages: Math.ceil(totalCount / pageOptions.take),
      totalCount,
    };
  }

  async findOne(id: number) {
    const packageDetail = await this.prismaService.packages.findFirst({
      where: {
        id: id,
      },
      include: {
        packageServices: {
          include: {
            service: true,
          },
        },
      },
    });
    if (!packageDetail) {
      throw new NotFoundException({
        message: 'Package not found',
        data: null,
      });
    }
    const { packageServices, ...packageData } = packageDetail;
    const services = packageServices.map((value) => {
      const { config, ...serviceInfo } = value.service;
      const configValue = JSON.parse(config);
      return {
        ...serviceInfo,
        config: configValue,
      };
    });
    return { ...packageData, services };
  }

  async update(id: number, updatePackageDto: UpdatePackageDto) {
    const packageDetail = await this.prismaService.packages.update({
      where: {
        id: id,
      },
      data: updatePackageDto,
    });
    if (!packageDetail) {
      throw new NotFoundException({
        message: 'Package not found',
        data: null,
      });
    }
    return packageDetail;
  }

  async remove(id: number) {
    const packageDetail = await this.prismaService.packages.delete({
      where: {
        id: id,
      },
    });
    if (!packageDetail) {
      throw new NotFoundException({
        message: 'Package not found',
        data: null,
      });
    }
    return packageDetail;
  }

  async getAllParents(childId: number): Promise<any[]> {
    const getParentsRecursive = async (id: number): Promise<any[]> => {
      const packages = await this.prismaService.packages.findUnique({
        where: { id },
        include: { parentPackage: true },
      });

      if (!packages || !packages.parentPackage) {
        return [];
      }

      const parent = packages.parentPackage;
      const parents = await getParentsRecursive(parent.id);
      return [parent, ...parents];
    };

    return getParentsRecursive(childId);
  }
}
