import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CorePrismaService } from 'src/prisma/prisma_core.service';
import { CreatePostDto, UpdatePostDto } from './dto';

@Injectable()
export class NewsService {
  constructor(private corePrismaService: CorePrismaService) {}

  async createPost(dto: CreatePostDto): Promise<{
    msg: string;
    data: any;
  }> {
    try {
      // Create new post
      await this.corePrismaService.posts.create({
        data: {
          ...dto,
        },
      });

      return {
        msg: 'success',
        data: {},
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new BadRequestException({
        msg: 'Failed to create post',
        data: null,
      });
    }
  }

  async getPosts(): Promise<{
    msg: string;
    data: any;
  }> {
    // Get all posts
    const posts = await this.corePrismaService.posts.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (posts.length === 0) {
      throw new NotFoundException({
        msg: 'No posts found',
        data: null,
      });
    }

    return {
      msg: 'success',
      data: posts,
    };
  }

  async updatePost(
    postId: number,
    dto: UpdatePostDto,
  ): Promise<{
    msg: string;
    data: any;
  }> {
    // Check if post exists
    const post = await this.corePrismaService.posts.findUnique({
      where: {
        id: postId,
      },
    });

    if (!post) {
      throw new NotFoundException({
        msg: 'Post not found',
        data: null,
      });
    }

    try {
      // Update post
      await this.corePrismaService.posts.update({
        where: {
          id: postId,
        },
        data: {
          ...dto,
        },
      });

      return {
        msg: 'success',
        data: {},
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new BadRequestException({
        msg: 'Failed to update post',
        data: null,
      });
    }
  }
}
