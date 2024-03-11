import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
    msg: string;
    data: mobile_mini_apps[];
  }> {
    const miniAppDataList =
      await this.corePrismaService.mobile_mini_apps.findMany();

    if (miniAppDataList.length === 0) {
      throw new NotFoundException({
        msg: 'No app data found',
        data: [],
      });
    }

    return {
      msg: 'success',
      data: miniAppDataList,
    };
  }

  async getMiniAppDataDetails(miniAppDataId: number): Promise<{
    msg: string;
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
        msg: 'App data not found',
        data: null,
      });
    }

    return {
      msg: 'success',
      data: miniAppData,
    };
  }

  async createMiniAppData(dto: CreateMiniAppDataDto): Promise<{
    msg: string;
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
        msg: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ForbiddenException({
            msg: 'Credentials taken',
            data: null,
          });
        }
      }

      throw new BadRequestException({
        msg: err,
        data: null,
      });
    }
  }

  async updateMiniAppData(
    miniAppDataId: number,
    dto: UpdateMiniAppDataDto,
  ): Promise<{
    msg: string;
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
        msg: 'App data not found',
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
        msg: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ForbiddenException({
            msg: 'Credentials taken',
            data: null,
          });
        }
      }

      throw new BadRequestException({
        msg: err.message,
        data: null,
      });
    }
  }

  async deleteMiniAppData(miniAppDataId: number): Promise<{
    msg: string;
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
        msg: 'App data not found',
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
        msg: 'success',
        data: null,
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new BadRequestException({
        msg: err.message,
        data: null,
      });
    }
  }
}
