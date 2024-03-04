import {
  Body,
  Controller,
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
import { UserRole } from '@prisma/client';

@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.admin)
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

  @Patch(':id')
  async updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return await this.newsService.updatePost(id, dto);
  }
}
