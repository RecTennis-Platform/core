import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { MobileMiniAppService } from './mobile_mini_app.service';
import { CreateMiniAppDataDto } from './dto/create-mini-app-data.dto';
import { UpdateMiniAppDataDto } from './dto/update-mini-app-data.dto';

@Controller('mobile-mini-apps')
export class MobileMiniAppController {
  constructor(private readonly mobileMiniAppService: MobileMiniAppService) {}

  @Get()
  async getAllMiniAppData() {
    return await this.mobileMiniAppService.getAllMiniAppData();
  }

  @Get(':id')
  async getMiniAppDetails(@Param('id', ParseIntPipe) id: number) {
    return await this.mobileMiniAppService.getMiniAppDataDetails(id);
  }

  @Post()
  async createMiniAppData(@Body() dto: CreateMiniAppDataDto) {
    return await this.mobileMiniAppService.createMiniAppData(dto);
  }

  @Put(':id')
  async updateMiniAppData(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMiniAppDataDto,
  ) {
    return await this.mobileMiniAppService.updateMiniAppData(id, dto);
  }

  @Delete('id')
  async deleteMiniAppData(@Param('id', ParseIntPipe) id: number) {
    return await this.mobileMiniAppService.deleteMiniAppData(id);
  }
}
