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
    message: string;
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
        message: 'Unauthorized',
        data: null,
      });
    }

    return {
      message: 'success',
      data: user,
    };
  }

  async createAdminAccount(dto: CreateAdminAccountDto): Promise<{
    message: string;
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
        message: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);

      if (err.code === 'P2002') {
        throw new BadRequestException({
          message: 'Email already exists',
          data: null,
        });
      }

      throw new BadRequestException({
        message: 'Error creating admin account',
        data: null,
      });
    }
  }

  async getAllUsers(): Promise<{
    message: string;
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
        message: 'No users found',
        data: [],
      });
    }

    return {
      message: 'success',
      data: users,
    };
  }

  async updateUserDetails(
    userId: number,
    dto: UpdateUserAccountDto,
  ): Promise<{
    message: string;
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
        message: 'User not found',
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
        message: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new BadRequestException({
        message: 'Error updating user details',
        data: null,
      });
    }
  }
}
