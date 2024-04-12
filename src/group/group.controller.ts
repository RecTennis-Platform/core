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
import { JwtGuard, RolesGuard } from 'src/auth_utils/guards';
import {
  CreateGroupDto,
  InviteUser2GroupDto,
  PageOptionsGroupDto,
  PageOptionsGroupMembershipDto,
  PageOptionsPostDto,
  PageOptionsUserDto,
  UpdateGroupDto,
} from './dto';
import { AddUser2GroupDto } from './dto/add-user-to-group.dto';
import { CreateGroupTournamentDto } from './dto/create-group-tournament.dto';
import { PageOptionsGroupTournamentDto } from './dto/page-options-group-tournament.dto';
import { PageOptionsParticipantsDto } from './dto/page-options-participants.dto';
import { GroupService } from './group.service';

@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  // Group
  @UseGuards(JwtGuard)
  @Post()
  async create(@GetUser('sub') adminId: number, @Body() dto: CreateGroupDto) {
    return await this.groupService.create(adminId, dto);
  }

  @UseGuards(JwtGuard)
  @Get()
  async findAllGroupsByUserId(
    @GetUser('sub') userId: number,
    @Query() dto: PageOptionsGroupMembershipDto,
  ) {
    return await this.groupService.findAllGroupsByUserId(userId, dto);
  }

  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('admin')
  async adminFindAll(@Query() dto: PageOptionsGroupDto) {
    return await this.groupService.findAllForAdmin(dto);
  }

  @UseGuards(JwtGuard)
  @Get(':id')
  async findOne(
    @GetUser('sub') userId: number,
    @Param('id', ParseIntPipe) groupId: number,
  ) {
    return await this.groupService.findOne(userId, groupId);
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

  // @UseGuards(JwtGuard)
  // @Patch(':id/activate')
  // async activate(
  //   @GetUser('sub') adminId: number,
  //   @Param('id', ParseIntPipe) id: number,
  // ) {
  //   return await this.groupService.activate(adminId, id);
  // }

  // Group Post
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
  async inviteUsers(
    @GetUser('sub') userId: number,
    @Body() dto: InviteUser2GroupDto,
  ) {
    return await this.groupService.inviteUser(userId, dto);
  }

  @UseGuards(JwtGuard)
  @Post('/user')
  async addUserToGroup(
    @GetUser('sub') userId: number,
    @Query() dto: AddUser2GroupDto,
  ) {
    return await this.groupService.addUserToGroup(userId, dto);
  }

  // Group Member
  @UseGuards(JwtGuard)
  @Get(':id/members')
  async findAllMembersByGroupId(
    @GetUser('sub') userId: number,
    @Param('id', ParseIntPipe) groupId: number,
    @Query() dto: PageOptionsUserDto,
  ) {
    return await this.groupService.findAllMembersByGroupId(
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
    return await this.groupService.removeMember(adminId, groupId, userId);
  }

  // Group Tournament
  @UseGuards(JwtGuard)
  @Post(':groupId/tournaments')
  async createGroupTournament(
    @GetUser('sub') userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: CreateGroupTournamentDto,
  ) {
    return await this.groupService.createGroupTournament(userId, groupId, dto);
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments')
  async getGroupTournaments(
    @GetUser('sub') userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query() dto: PageOptionsGroupTournamentDto,
  ) {
    return await this.groupService.getGroupTournaments(userId, groupId, dto);
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments/:tournamentId/general-info')
  async getGroupTournamentGeneralInfo(
    @GetUser('sub') userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ) {
    return await this.groupService.getGroupTournamentGeneralInfo(
      userId,
      groupId,
      tournamentId,
    );
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments/:tournamentId/participants')
  async getGroupTournamentParticipants(
    @GetUser('sub') userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query() dto: PageOptionsParticipantsDto,
  ) {
    return await this.groupService.getGroupTournamentParticipants(
      userId,
      groupId,
      tournamentId,
      dto,
    );
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments/:tournamentId/non-participants')
  async getGroupTournamentNonParticipants(
    @GetUser('sub') userId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ) {
    return await this.groupService.getGroupTournamentNonParticipants(
      userId,
      groupId,
      tournamentId,
    );
  }

  // @UseGuards(JwtGuard)
  // @Post(':groupId/tournaments/:tournamentId/participants')
  // async addGroupTournamentParticipant(
  //   @GetUser('sub') userId: number,
  //   @Param('groupId', ParseIntPipe) groupId: number,
  //   @Param('tournamentId', ParseIntPipe) tournamentId: number,
  //   @Body() dto: AddParticipantsDto,
  // ) {
  //   return await this.groupService.addGroupTournamentParticipant(
  //     userId,
  //     groupId,
  //     tournamentId,
  //     dto,
  //   );
  // }

  // @UseGuards(JwtGuard)
  // @Delete(':groupId/tournaments/:tournamentId/participants/:userId')
  // async removeGroupTournamentParticipant(
  //   @GetUser('sub') userId: number,
  //   @Param('groupId', ParseIntPipe) groupId: number,
  //   @Param('tournamentId', ParseIntPipe) tournamentId: number,
  //   @Param('userId', ParseIntPipe) participantId: number,
  // ) {
  //   return await this.groupService.removeGroupTournamentParticipant(
  //     userId,
  //     groupId,
  //     tournamentId,
  //     participantId,
  //   );
  // }
}
