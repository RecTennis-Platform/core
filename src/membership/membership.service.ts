import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMembershipDto, PageOptionsUserDto } from './dto';
import { MemberRole } from '@prisma/client';

@Injectable()
export class MembershipService {
  constructor(private prismaService: PrismaService) {}

  async create(dto: CreateMembershipDto) {
    // Check if the user is already a member of the group
    const isMember = await this.prismaService.member_ships.findFirst({
      where: {
        userId: dto.userId,
        groupId: dto.groupId,
      },
    });

    if (isMember) {
      throw new ForbiddenException({
        message: 'You are already a member of this group',
        data: null,
      });
    }

    try {
      await this.prismaService.member_ships.create({
        data: {
          ...dto,
        },
      });

      return {
        message: 'Member added successfully',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to add the member',
        data: null,
      });
    }
  }

  async findAllMembersByGroupId(
    userId: number,
    groupId: number,
    dto: PageOptionsUserDto,
  ) {
    // Check if the user is a member of the group
    const isMember = await this.prismaService.member_ships.findFirst({
      where: {
        userId,
        groupId,
      },
    });

    if (!isMember) {
      throw new ForbiddenException({
        message: 'You are not a member of this group',
        data: null,
      });
    }

    const conditions = {
      orderBy: [
        {
          createdAt: dto.order,
        },
      ],
      where: {
        groupId,
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
      this.prismaService.member_ships.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
            },
          },
        },
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.member_ships.count({
        ...conditions,
      }),
    ]);

    return {
      data: result,
      totalPages: Math.ceil(totalCount / dto.take),
      totalCount,
    };
  }

  async remove(adminId: number, groupId: number, userId: number) {
    // Check if the admin is a member of the group
    const isAdmin = await this.prismaService.member_ships.findFirst({
      where: {
        userId: adminId,
        groupId,
        role: MemberRole.group_admin,
      },
    });

    if (!isAdmin) {
      throw new ForbiddenException({
        message: 'You are not an admin of this group',
        data: null,
      });
    }

    // Check if the user is a member of the group
    const userIsMember = await this.prismaService.member_ships.findFirst({
      where: {
        userId: userId,
        groupId,
      },
    });

    if (!userIsMember) {
      throw new NotFoundException({
        message: 'This user is not a member of this group',
        data: null,
      });
    }

    try {
      await this.prismaService.member_ships.delete({
        where: {
          userId_groupId: {
            groupId,
            userId,
          },
        },
      });

      return {
        message: 'Member removed successfully',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to remove the member',
        data: null,
      });
    }
  }

  async findAllOwnedGroupsByUserId(userId: number) {
    const groups = await this.prismaService.member_ships.findMany({
      where: {
        userId,
        role: MemberRole.group_admin,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            image: true,
            activityZone: true,
            language: true,
            description: true,
            status: true,
            startDate: true,
            endDate: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                member_ships: true,
              },
            },
          },
        },
      },
    });

    // Modify the structure of the returned data
    const modifiedGroups = groups.map((group) => {
      const memberCount = group.group._count.member_ships;
      delete group.group._count;

      return {
        ...group.group,
        memberCount,
      };
    });

    return modifiedGroups;
  }
}
