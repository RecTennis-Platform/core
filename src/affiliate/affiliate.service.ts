import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAffiliateDto } from './dto/create-affiliate.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AffiliateStatus } from '@prisma/client';
import { PageOptionsAffiliateDto } from './dto/find-all-affiliate.dto';

@Injectable()
export class AffiliateService {
  constructor(private prismaService: PrismaService) {}
  async create(createAffiliateDto: CreateAffiliateDto) {
    const data = {
      companyName: createAffiliateDto.companyName,
      contactPersonName: createAffiliateDto.contactPersonName,
      description: createAffiliateDto.description,
      email: createAffiliateDto.email,
      phone: createAffiliateDto.phone,
      taxNumber: createAffiliateDto.taxNumber,
      website: createAffiliateDto.website,
      status: AffiliateStatus.pending,
    };
    return await this.prismaService.affiliates.create({ data });
  }

  async findAll(pageOptionsAffiliateDto: PageOptionsAffiliateDto) {
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsAffiliateDto.order,
        },
      ],
      where: {
        status: pageOptionsAffiliateDto.status,
      },
    };

    const pageOption =
      pageOptionsAffiliateDto.page && pageOptionsAffiliateDto.take
        ? {
            skip: pageOptionsAffiliateDto.skip,
            take: pageOptionsAffiliateDto.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.affiliates.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.affiliates.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptionsAffiliateDto.take),
      totalCount,
    };
  }

  async findOne(id: number) {
    const affiliate = await this.prismaService.affiliates.findFirst({
      where: {
        id: id,
      },
    });
    if (!affiliate) {
      throw new NotFoundException({
        message: 'Affiliate not found',
        data: null,
      });
    }
  }

  async update(id: number, updateAffiliateDto: UpdateAffiliateDto) {
    const affiliate = await this.prismaService.affiliates.update({
      where: {
        id: id,
      },
      data: {
        companyName: updateAffiliateDto?.companyName,
        contactPersonName: updateAffiliateDto?.contactPersonName,
        taxNumber: updateAffiliateDto?.taxNumber,
        website: updateAffiliateDto?.website,
        description: updateAffiliateDto?.description,
        email: updateAffiliateDto?.email,
        phone: updateAffiliateDto?.phone,
      },
    });
    if (!affiliate) {
      throw new NotFoundException({
        message: 'Affiliate not found',
        data: null,
      });
    }
  }

  async remove(id: number) {
    const affiliate = await this.prismaService.affiliates.delete({
      where: {
        id: id,
      },
    });
    if (!affiliate) {
      throw new NotFoundException({
        message: 'Affiliate not found',
        data: null,
      });
    }
  }
}
