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
import { JwtGuard, JwtInviteUserGuard } from 'src/auth_utils/guards';
import {
  CreateGroupDto,
  UpdateGroupDto,
  PageOptionsGroupDto,
  PageOptionsPostDto,
  InviteUser2GroupDto
} from './dto';
import { GroupService } from './group.service';

@Controller('groups')
export class GroupController {
  constructor(private groupService: GroupService) {}

  // Group
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

  // Group post
  @Get(':id/posts')
  async getPosts(
    @Param('id', ParseIntPipe) groupId: number,
    @Query() pageOptionsPostDto: PageOptionsPostDto,
  ) {
    return await this.groupService.getPosts(groupId, pageOptionsPostDto);
  }

  @Get(':id/posts/:postId')
  async getPostDetails(
    @Param('id', ParseIntPipe) id: number,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    return await this.groupService.getPostDetails(id, postId);
  }

  // @UseGuards(JwtGuard)
  // @Post(':id/posts')
  // async createPost(
  //   @GetUser('sub') userId: number,
  //   @Param('id', ParseIntPipe) groupId: number,
  // ) {
  //   return await this.groupService.createPost(userId, groupId);
  // }

  // @UseGuards(JwtGuard)
  // @Patch(':id/posts/:postId')
  // async updatePost(
  //   @GetUser('sub') adminId: number,
  //   @Param('id', ParseIntPipe) id: number,
  //   @Param('postId', ParseIntPipe) postId: number,
  // ) {}

  // @UseGuards(JwtGuard)
  // @Patch(':id/posts/:postId/delete')
  // async deletePost(
  //   @GetUser('sub') adminId: number,
  //   @Param('id', ParseIntPipe) id: number,
  //   @Param('postId', ParseIntPipe) postId: number,
  // ) {}

  // Invite user
  @UseGuards(JwtGuard)
  @Post('invite')
  async inviteUsers(@Body() dto: InviteUser2GroupDto) {
    return await this.groupService.inviteUser(dto);
  }

  @UseGuards(JwtInviteUserGuard)
  @Post('/user')
  async addUserToGroup(
    @GetUser('sub') userId: number,
    @GetUser('email') email: string,
    @GetUser('groupId') groupId: number,
  ) {
    return await this.groupService.adduserToGroup(email, groupId, userId);
  }
}
