import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupStatus } from '@prisma/client';
import { CorePrismaService } from 'src/prisma/prisma_core.service';
import { CreateGroupDto, UpdateGroupDto } from './dto';
import { PageOptionsGroupDto } from './dto/page-options-group.dto';

@Injectable()
export class GroupService {
  constructor(private corePrismaService: CorePrismaService) {}

  async create(adminId: number, dto: CreateGroupDto) {
    const purchasedPackage = await this.corePrismaService.packages.findUnique({
      where: {
        id: dto.packageId,
      },
    });

    if (!purchasedPackage) {
      throw new NotFoundException({
        message: 'Package not found',
        data: null,
      });
    }

    try {
      const data = await this.corePrismaService.groups.create({
        data: {
          adminId,
          status: GroupStatus.inactive,
          ...dto,
        },
      });

      return {
        message: 'Group created successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to create group',
        data: null,
      });
    }
  }

  async findAll(dto: PageOptionsGroupDto) {
    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
      where: {
        status: dto.status,
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
      this.corePrismaService.groups.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.corePrismaService.groups.count({ ...conditions }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async findOne(id: number) {
    const group = await this.corePrismaService.groups.findUnique({
      where: {
        id,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    return {
      data: group,
    };
  }

  async update(adminId: number, id: number, dto: UpdateGroupDto) {
    const group = await this.corePrismaService.groups.findUnique({
      where: {
        id,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    if (group.adminId !== adminId) {
      throw new ForbiddenException({
        message: 'You are not authorized to update this group',
        data: null,
      });
    }

    const updatedData = { ...group, ...dto };
    const hasChanges = JSON.stringify(updatedData) !== JSON.stringify(group);

    if (!hasChanges) {
      throw new BadRequestException({
        message: 'No changes were made to the group',
        data: null,
      });
    }

    try {
      const data = await this.corePrismaService.groups.update({
        where: {
          id,
        },
        data: {
          ...dto,
        },
      });

      return {
        message: 'Group updated successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to update group',
        data: null,
      });
    }
  }

  async activate(adminId: number, id: number) {
    const group = await this.corePrismaService.groups.findUnique({
      where: {
        id,
      },
      include: {
        package: true,
      },
    });

    if (!group) {
      throw new NotFoundException({
        message: 'Group not found',
        data: null,
      });
    }

    if (group.status === GroupStatus.active) {
      throw new ConflictException({
        message: 'Group is already active',
        data: null,
      });
    }

    if (group.adminId !== adminId) {
      throw new ForbiddenException({
        message: 'You are not authorized to activate this group',
        data: null,
      });
    }

    try {
      const duration = group.package.duration;
      const data = await this.corePrismaService.groups.update({
        where: {
          id,
        },
        data: {
          status: GroupStatus.active,
          startDate: new Date(),
          endDate: new Date(
            new Date().setDate(new Date().getDate() + duration),
          ),
        },
      });

      return {
        message: 'Group activated successfully',
        data,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        message: 'Failed to activate group',
        data: null,
      });
    }
  }
}
