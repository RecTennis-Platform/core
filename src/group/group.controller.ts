import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from 'src/auth_utils/decorators';
import { JwtGuard } from 'src/auth_utils/guards';
import { CreateGroupDto, UpdateGroupDto } from './dto';
import { PageOptionsGroupDto } from './dto/page-options-group.dto';
import { GroupService } from './group.service';

@Controller('groups')
export class GroupController {
  constructor(private groupService: GroupService) {}

  @UseGuards(JwtGuard)
  @Post()
  async create(@GetUser('sub') adminId: number, @Body() dto: CreateGroupDto) {
    return await this.groupService.create(adminId, dto);
  }

  @Get()
  async findAll(@Query() dto: PageOptionsGroupDto) {
    return await this.groupService.findAll(dto);
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.groupService.findOne(id);
  }

  @UseGuards(JwtGuard)
  @Patch(':id')
  async update(
    @GetUser('sub') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
  ) {
    return await this.groupService.update(adminId, id, dto);
  }

  @UseGuards(JwtGuard)
  @Patch(':id/activate')
  async activate(
    @GetUser('sub') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.groupService.activate(adminId, id);
  }
}
