import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from 'src/prisma/prisma_core.service';
import { CreateMiniAppDataDto, UpdateMiniAppDataDto } from './dto';
import { mobile_mini_apps } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class MobileMiniAppService {
  constructor(private corePrismaService: CorePrismaService) {}

  async getAllMiniAppData(): Promise<{
    message: string;
    data: mobile_mini_apps[];
  }> {
    const miniAppDataList =
      await this.corePrismaService.mobile_mini_apps.findMany();

    if (miniAppDataList.length === 0) {
      throw new NotFoundException({
        message: 'No app data found',
        data: [],
      });
    }

    return {
      message: 'success',
      data: miniAppDataList,
    };
  }

  async getMiniAppDataDetails(miniAppDataId: number): Promise<{
    message: string;
    data: mobile_mini_apps;
  }> {
    const miniAppData =
      await this.corePrismaService.mobile_mini_apps.findUnique({
        where: {
          id: miniAppDataId,
        },
      });

    if (!miniAppData) {
      throw new NotFoundException({
        message: 'App data not found',
        data: null,
      });
    }

    return {
      message: 'success',
      data: miniAppData,
    };
  }

  async createMiniAppData(dto: CreateMiniAppDataDto): Promise<{
    message: string;
    data: any;
  }> {
    try {
      console.log('dto', dto);
      // Create new mini app data
      await this.corePrismaService.mobile_mini_apps.create({
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
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ForbiddenException({
            message: 'Credentials taken',
            data: null,
          });
        }
      }

      throw new InternalServerErrorException({
        message: err,
        data: null,
      });
    }
  }

  async updateMiniAppData(
    miniAppDataId: number,
    dto: UpdateMiniAppDataDto,
  ): Promise<{
    message: string;
    data: any;
  }> {
    // Check if mini app data exists
    const miniAppData =
      await this.corePrismaService.mobile_mini_apps.findUnique({
        where: {
          id: miniAppDataId,
        },
      });

    if (!miniAppData) {
      throw new NotFoundException({
        message: 'App data not found',
        data: null,
      });
    }

    try {
      // Update mini app data
      await this.corePrismaService.mobile_mini_apps.update({
        where: {
          id: miniAppDataId,
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
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ForbiddenException({
            message: 'Credentials taken',
            data: null,
          });
        }
      }

      throw new InternalServerErrorException({
        message: err.message,
        data: null,
      });
    }
  }

  async deleteMiniAppData(miniAppDataId: number): Promise<{
    message: string;
    data: any;
  }> {
    // Check if mini app data exists
    const miniAppData =
      await this.corePrismaService.mobile_mini_apps.findUnique({
        where: {
          id: miniAppDataId,
        },
      });

    if (!miniAppData) {
      throw new NotFoundException({
        message: 'App data not found',
        data: null,
      });
    }

    try {
      // Delete mini app data
      await this.corePrismaService.mobile_mini_apps.delete({
        where: {
          id: miniAppDataId,
        },
      });

      return {
        message: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new InternalServerErrorException({
        message: err.message,
        data: null,
      });
    }
  }
}
