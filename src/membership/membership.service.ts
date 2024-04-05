import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMembershipDto } from './dto';

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
}
