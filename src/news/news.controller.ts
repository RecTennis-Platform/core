import { Body, Controller, Get, Post } from '@nestjs/common';
import { NewsService } from './news.service';
import { CreatePostDto } from './dto';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post()
  async createPost(@Body() dto: CreatePostDto) {
    return await this.newsService.createPost(dto);
  }

  @Get()
  async getNews() {
    return await this.newsService.getPosts();
  }
}
