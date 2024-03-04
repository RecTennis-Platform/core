import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto } from './dto';

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
    } catch (err) {
      console.log('Error:', err.message);
      throw new Error(err);
    }
  }

  async getPosts() {
    try {
      // Get all posts
      return await this.prismaService.posts.findMany({
        orderBy: {
          created_at: 'desc',
        },
      });
    } catch (err) {
      console.log('Error:', err.message);
      throw new Error(err);
    }
  }
}
