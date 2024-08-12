import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PageOptionsServiceDto } from './dto/page-options-service.dto';

@Injectable()
export class ServiceService {
  constructor(private prismaService: PrismaService) {}
  async create(createServiceDto: CreateServiceDto) {
    return await this.prismaService.services.create({
      data: createServiceDto,
    });
  }

  async findAll(dto: PageOptionsServiceDto) {
    const conditions = {
      orderBy: [
        {
          id: dto.order,
        },
      ],
      where: {
        type: dto?.type,
        level: dto?.level,
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
      this.prismaService.services.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.services.count({
        ...conditions,
      }),
    ]);
    const services = result.map((service) => {
      const config = JSON.parse(service.config);
      delete service.config;
      return {
        ...service,
        config,
      };
    });

    return {
      data: services,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findOne(id: number) {
    const foundService = await this.prismaService.services.findUnique({
      where: {
        id,
      },
    });
    if (!foundService) {
      throw new NotFoundException({
        message: 'Service not found',
        data: null,
      });
    }
    const config = JSON.parse(foundService.config);
    delete foundService.config;
    return {
      ...foundService,
      config,
    };
  }

  async update(id: number, updateServiceDto: UpdateServiceDto) {
    const foundService = await this.prismaService.services.findUnique({
      where: {
        id,
      },
    });
    if (!foundService) {
      throw new NotFoundException({
        message: 'Service not found',
        data: null,
      });
    }
    return await this.prismaService.services.update({
      where: {
        id,
      },
      data: updateServiceDto,
    });
  }

  async remove(id: number) {
    const foundService = await this.prismaService.services.findUnique({
      where: {
        id,
      },
      include: {
        packageServices: true,
      },
    });
    if (!foundService) {
      throw new NotFoundException({
        message: 'Service not found',
        data: null,
      });
    }
    if (foundService.packageServices.length > 0) {
      throw new BadRequestException({
        message: 'Service is already used in packages',
        data: null,
      });
    }
    return await this.prismaService.services.delete({
      where: {
        id,
      },
    });
  }
}
