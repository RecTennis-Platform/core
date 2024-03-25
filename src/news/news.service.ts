import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNewsDto, PageOptionsNewsDto, UpdateNewsDto } from './dto';

@Injectable()
export class NewsService {
  constructor(private prismaService: PrismaService) {}

  async createNews(dto: CreateNewsDto) {
    try {
      // Create news
      await this.prismaService.news.create({
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
      throw new InternalServerErrorException({
        message: 'Failed to create news',
        data: null,
      });
    }
  }

  async getNewsList(pageOptionsNewsDto: PageOptionsNewsDto) {
    // Get all news
    const conditions = {
      orderBy: [
        {
          createdAt: pageOptionsNewsDto.order,
        },
      ],
    };

    const pageOption =
      pageOptionsNewsDto.page && pageOptionsNewsDto.take
        ? {
            skip: pageOptionsNewsDto.skip,
            take: pageOptionsNewsDto.take,
          }
        : undefined;

    const [result, totalCount] = await Promise.all([
      this.prismaService.news.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.prismaService.news.count({ ...conditions }),
    ]);

    return {
      message: 'success',
      data: result,
      totalPages: Math.ceil(totalCount / pageOptionsNewsDto.take),
      totalCount,
    };
  }

  async getTopNews() {
    // Get all news
    const result = await this.prismaService.news.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      message: 'success',
      data: result,
    };
  }

  async getNewsDetails(newsId: number) {
    // Get news details
    const news = await this.prismaService.news.findUnique({
      where: {
        id: newsId,
      },
    });

    if (!news) {
      throw new NotFoundException({
        message: 'News not found',
        data: null,
      });
    }

    return {
      message: 'success',
      data: news,
    };
  }

  async updateNews(newsId: number, dto: UpdateNewsDto) {
    // Check if news exists
    const news = await this.prismaService.news.findUnique({
      where: {
        id: newsId,
      },
    });

    if (!news) {
      throw new NotFoundException({
        message: 'News not found',
        data: null,
      });
    }

    try {
      // Update news
      await this.prismaService.news.update({
        where: {
          id: newsId,
        },
        data: {
          ...dto,
        },
      });

      return {
        message: 'success',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to update news',
        data: null,
      });
    }
  }

  async deleteNews(newsId: number) {
    // Check if news exists
    const news = await this.prismaService.news.findUnique({
      where: {
        id: newsId,
      },
    });

    if (!news) {
      throw new NotFoundException({
        message: 'News not found',
        data: null,
      });
    }

    try {
      // Delete news
      await this.prismaService.news.delete({
        where: {
          id: newsId,
        },
      });

      return {
        message: 'success',
        data: null,
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new InternalServerErrorException({
        message: 'Failed to delete news',
        data: null,
      });
    }
  }
}
