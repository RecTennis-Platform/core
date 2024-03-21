import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NewsService } from './news.service';
import { JwtGuard, RolesGuard } from '../auth_utils/guards';
import { CreateNewsDto, PageOptionsNewsDto, UpdateNewsDto } from './dto';
import { Roles } from '../auth_utils/decorators/roles.decorator';
import { UserRole } from '@internal/prisma_auth/client';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Post()
  async createNews(@Body() dto: CreateNewsDto) {
    return await this.newsService.createNews(dto);
  }

  @Get()
  async getNewsList(@Query() pageOptionsNewsDto: PageOptionsNewsDto) {
    return await this.newsService.getNewsList(pageOptionsNewsDto);
  }

  @Get('/top')
  async getTopNews() {
    return await this.newsService.getTopNews();
  }

  @Get(':id')
  async getNewsDetails(@Param('id', ParseIntPipe) id: number) {
    return await this.newsService.getNewsDetails(id);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Patch(':id')
  async updateNews(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNewsDto,
  ) {
    return await this.newsService.updateNews(id, dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Delete(':id')
  async deleteNews(@Param('id', ParseIntPipe) id: number) {
    return await this.newsService.deleteNews(id);
  }
}
