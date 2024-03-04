import { Injectable } from '@nestjs/common';
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
    return await this.prismaService.affiliate.create({ data });
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
      this.prismaService.affiliate.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.affiliate.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / pageOptionsAffiliateDto.take),
      totalCount,
    };
  }

  async findOne(id: number) {
    return await this.prismaService.affiliate.findFirst({
      where: {
        id: id,
      },
    });
  }

  async update(id: number, updateAffiliateDto: UpdateAffiliateDto) {
    return await this.prismaService.affiliate.update({
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
  }

  async remove(id: number) {
    return await this.prismaService.affiliate.delete({
      where: {
        id: id,
      },
    });
  }
}
