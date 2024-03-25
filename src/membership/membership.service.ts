import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PageOptionsUserDto } from './dto';

@Injectable()
export class MembershipService {
  constructor(private prismaService: PrismaService) {}

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
    const isMember = await this.prismaService.member_ships.findFirst({
      where: {
        userId: adminId,
        groupId,
      },
    });

    if (!isMember) {
      throw new ForbiddenException({
        message: 'You are not a member of this group',
        data: null,
      });
    }

    // Check if the admin is an admin of the group
    const isAdmin = await this.prismaService.groups.findFirst({
      where: {
        id: groupId,
        adminId,
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
}
