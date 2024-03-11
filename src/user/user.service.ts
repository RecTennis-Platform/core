import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon from 'argon2';
import { AuthPrismaService } from 'src/prisma/prisma_auth.service';
import { CreateAdminAccountDto, UpdateUserAccountDto } from './dto';
import { UserRole } from '@internal/prisma_auth/client';

@Injectable()
export class UserService {
  constructor(private authPrismaService: AuthPrismaService) {}

  async getUserDetails(userId: number): Promise<{
    msg: string;
    data: any;
  }> {
    const user = await this.authPrismaService.users.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
      },
    });

    if (!user) {
      throw new BadRequestException({
        msg: 'Unauthorized',
        data: null,
      });
    }

    return {
      msg: 'success',
      data: user,
    };
  }

  async createAdminAccount(dto: CreateAdminAccountDto): Promise<{
    msg: string;
    data: any;
  }> {
    try {
      // Hash password
      const hash = await argon.hash(process.env.DEFAULT_ADMIN_PASSWORD);

      // Create account
      await this.authPrismaService.users.create({
        data: {
          ...dto,
          password: hash,
          role: UserRole.admin,
          image: null,
        },
      });

      return {
        msg: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);

      if (err.code === 'P2002') {
        throw new BadRequestException({
          msg: 'Email already exists',
          data: null,
        });
      }

      throw new BadRequestException({
        msg: 'Error creating admin account',
        data: null,
      });
    }
  }

  async getAllUsers(): Promise<{
    msg: string;
    data: any;
  }> {
    const users = await this.authPrismaService.users.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
      },
    });

    if (users.length === 0) {
      throw new NotFoundException({
        msg: 'No users found',
        data: [],
      });
    }

    return {
      msg: 'success',
      data: users,
    };
  }

  async updateUserDetails(
    userId: number,
    dto: UpdateUserAccountDto,
  ): Promise<{
    msg: string;
    data: any;
  }> {
    // Check if user exists
    const user = await this.authPrismaService.users.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException({
        msg: 'User not found',
        data: null,
      });
    }

    try {
      // Update user details
      await this.authPrismaService.users.update({
        where: {
          id: userId,
        },
        data: {
          ...dto,
        },
      });

      return {
        msg: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new BadRequestException({
        msg: 'Error updating user details',
        data: null,
      });
    }
  }
}
