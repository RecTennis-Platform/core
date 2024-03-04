import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto';

@Injectable()
export class NewsService {
  constructor(private prismaService: PrismaService) {}

  async createPost(dto: CreatePostDto) {
    try {
      // Create new post
      await this.prismaService.posts.create({
        data: {
          image: dto.image,
          title: dto.title,
          description: dto.description,
          content: dto.content,
        },
      });

      return {
        msg: 'success',
        data: {},
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new Error(err);
    }
  }

  async getPosts() {
    try {
      // Get all posts
      const posts = await this.prismaService.posts.findMany({
        orderBy: {
          created_at: 'desc',
        },
      });

      return {
        msg: 'success',
        data: posts,
      };
    } catch (err) {
      console.log('Error:', err.message);
      throw new Error(err);
    }
  }

  async updatePost(postId: number, dto: UpdatePostDto) {
    try {
      // Update post
      await this.prismaService.posts.update({
        where: {
          id: postId,
        },
        data: {
          image: dto.image,
          title: dto.title,
          description: dto.description,
          content: dto.content,
        },
      });

      return {
        msg: 'success',
        data: {},
      };
    } catch (error) {
      console.log('Error:', error.message);
      throw new Error(error);
    }
  }
}
