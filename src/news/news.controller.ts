import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { JwtGuard, RolesGuard } from '../auth_utils/guards';
import { CreatePostDto, UpdatePostDto } from './dto';
import { Roles } from '../auth_utils/decorators/roles.decorator';
import { UserRole } from '@internal/prisma_auth/client';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Post()
  async createPost(@Body() dto: CreatePostDto) {
    return await this.newsService.createPost(dto);
  }

  @Get()
  async getNews() {
    return await this.newsService.getPosts();
  }

  @Get('/top')
  async getTopNews() {
    return await this.newsService.getTopPosts();
  }

  @Get(':id')
  async getPostDetails(@Param('id', ParseIntPipe) id: number) {
    return await this.newsService.getPostDetails(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Patch(':id')
  async updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return await this.newsService.updatePost(id, dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Delete(':id')
  async deletePost(@Param('id', ParseIntPipe) id: number) {
    return await this.newsService.deletePost(id);
  }
}
