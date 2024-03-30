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
import { UserRole } from '@prisma/client';
import { GetUser, Roles } from 'src/auth_utils/decorators';
import { JwtGuard, JwtInviteUserGuard } from 'src/auth_utils/guards';
import { PageOptionsGroupDto, PageOptionsUserDto } from 'src/membership/dto';
import { MembershipService } from 'src/membership/membership.service';
import {
  CreateGroupDto,
  InviteUser2GroupDto,
  PageOptionsPostDto,
  UpdateGroupDto,
} from './dto';
import { GroupService } from './group.service';

@Controller('groups')
export class GroupController {
  constructor(
    private groupService: GroupService,
    private membershipService: MembershipService,
  ) {}

  // Group
  @UseGuards(JwtGuard)
  @Post()
  async create(@GetUser('sub') adminId: number, @Body() dto: CreateGroupDto) {
    return await this.groupService.create(adminId, dto);
  }

  @UseGuards(JwtGuard)
  @Get()
  async findAll(
    @GetUser('sub') userId: number,
    @Query() dto: PageOptionsGroupDto,
  ) {
    return await this.membershipService.findAllGroupsByUserId(userId, dto);
  }

  @UseGuards(JwtGuard)
  @Roles(UserRole.admin)
  @Get('/admin')
  async adminFindAll(@Query() dto: PageOptionsGroupDto) {
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
  // @Patch(':id/posts/:postId/delete') // @Delete(':id/posts/:postId') instead
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
    return await this.groupService.addUserToGroup(email, groupId, userId);
  }

  @UseGuards(JwtGuard)
  @Get(':id/members')
  async findAllMembersByGroupId(
    @GetUser('sub') userId: number,
    @Param('id', ParseIntPipe) groupId: number,
    @Query() dto: PageOptionsUserDto,
  ) {
    return await this.membershipService.findAllMembersByGroupId(
      userId,
      groupId,
      dto,
    );
  }

  @UseGuards(JwtGuard)
  @Delete(':id/members/:userId')
  async removeMember(
    @GetUser('sub') adminId: number,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return await this.membershipService.remove(adminId, groupId, userId);
  }
}
