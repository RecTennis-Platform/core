import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from 'src/prisma/prisma_core.service';
import { CreateNewsDto, PageOptionsNewsDto, UpdateNewsDto } from './dto';

@Injectable()
export class NewsService {
  constructor(private corePrismaService: CorePrismaService) {}

  async createNews(dto: CreateNewsDto) {
    try {
      // Create news
      await this.corePrismaService.news.create({
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
      this.corePrismaService.news.findMany({
        ...conditions,
        ...pageOption,
      }),
      this.corePrismaService.news.count({ ...conditions }),
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
    const result = await this.corePrismaService.news.findMany({
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
    const news = await this.corePrismaService.news.findUnique({
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
    const news = await this.corePrismaService.news.findUnique({
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
      await this.corePrismaService.news.update({
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
    const news = await this.corePrismaService.news.findUnique({
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
      await this.corePrismaService.news.delete({
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
