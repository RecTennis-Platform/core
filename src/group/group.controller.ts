import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FixtureStatus, UserRole } from '@prisma/client';
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
import { AddParticipantsDto } from './dto/add-participants.dto';
import { AddUser2GroupDto } from './dto/add-user-to-group.dto';
import { CreateGroupTournamentDto } from './dto/create-group-tournament.dto';
import { PageOptionsGroupTournamentDto } from './dto/page-options-group-tournament.dto';
import { PageOptionsParticipantsDto } from './dto/page-options-participants.dto';
import { GroupService } from './group.service';
import { AddRefereesTournamentDto } from 'src/tournament/dto/create-referees_tournament.dto';
import { CreateRefereesGroupTournamentDto } from 'src/referees_tournaments/dto/create-referees_tournament.dto';
import { PageOptionsRefereesGroupTournamentsDto } from 'src/referees_tournaments/dto/page-options-referees-tournaments.dto';
import { PageOptionsTournamentRegistrationDto } from 'src/tournament/dto';
import {
  CreateFixtureDto,
  GenerateFixtureDto,
} from 'src/fixture/dto/create-fixture.dto';
import { FixtureService } from 'src/fixture/fixture.service';
import { CreateFixturePublishDto } from 'src/fixture/dto/create-fixture-save-publish.dto';

@Controller('groups')
export class GroupController {
  constructor(
    private readonly groupService: GroupService,
    private readonly fixtureService: FixtureService,
  ) {}

  // Group
  @UseGuards(JwtGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(@GetUser('sub') adminId: string, @Body() dto: CreateGroupDto) {
    return await this.groupService.create(adminId, dto);
  }

  @UseGuards(JwtGuard)
  @Get()
  async findAllGroupsByUserId(
    @GetUser('sub') userId: string,
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
    @GetUser('sub') userId: string,
    @Param('id', ParseIntPipe) groupId: number,
  ) {
    return await this.groupService.findOne(userId, groupId);
  }

  @UseGuards(JwtGuard)
  @Patch(':id')
  async update(
    @GetUser('sub') adminId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
  ) {
    return await this.groupService.update(adminId, id, dto);
  }

  // @UseGuards(JwtGuard)
  // @Patch(':id/activate')
  // async activate(
  //   @GetUser('sub') adminId: string,
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
  //   @GetUser('sub') userId: string,
  //   @Param('id', ParseIntPipe) groupId: number,
  // ) {
  //   return await this.groupService.createPost(userId, groupId);
  // }

  // @UseGuards(JwtGuard)
  // @Patch(':id/posts/:postId')
  // async updatePost(
  //   @GetUser('sub') adminId: string,
  //   @Param('id', ParseIntPipe) id: number,
  //   @Param('postId', ParseIntPipe) postId: number,
  // ) {}

  // @UseGuards(JwtGuard)
  // @Patch(':id/posts/:postId/delete') // @Delete(':id/posts/:postId') instead
  // async deletePost(
  //   @GetUser('sub') adminId: string,
  //   @Param('id', ParseIntPipe) id: number,
  //   @Param('postId', ParseIntPipe) postId: number,
  // ) {}

  // Invite user
  @UseGuards(JwtGuard)
  @Post('invite')
  async inviteUsers(
    @GetUser('sub') userId: string,
    @Body() dto: InviteUser2GroupDto,
  ) {
    return await this.groupService.inviteUser(userId, dto);
  }

  @UseGuards(JwtGuard)
  @Post('/user')
  async addUserToGroup(
    @GetUser('sub') userId: string,
    @Query() dto: AddUser2GroupDto,
  ) {
    return await this.groupService.addUserToGroup(userId, dto);
  }

  // Group Member
  @UseGuards(JwtGuard)
  @Get(':id/members')
  async findAllMembersByGroupId(
    @GetUser('sub') userId: string,
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
    @GetUser('sub') adminId: string,
    @Param('id', ParseIntPipe) groupId: number,
    @Param('userId') userId: string,
  ) {
    return await this.groupService.removeMember(adminId, groupId, userId);
  }

  // Group Tournament
  @UseGuards(JwtGuard)
  @Post(':groupId/tournaments')
  async createGroupTournament(
    @GetUser('sub') userId: string,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() dto: CreateGroupTournamentDto,
  ) {
    return await this.groupService.createGroupTournament(userId, groupId, dto);
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments')
  async getGroupTournaments(
    @GetUser('sub') userId: string,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query() dto: PageOptionsGroupTournamentDto,
  ) {
    return await this.groupService.getGroupTournaments(userId, groupId, dto);
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments/:tournamentId/general-info')
  async getGroupTournamentGeneralInfo(
    @GetUser('sub') userId: string,
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
    @GetUser('sub') userId: string,
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
    @GetUser('sub') userId: string,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ) {
    return await this.groupService.getGroupTournamentNonParticipants(
      userId,
      groupId,
      tournamentId,
    );
  }

  @UseGuards(JwtGuard)
  @Post(':groupId/tournaments/:tournamentId/participants')
  async addGroupTournamentParticipant(
    @GetUser('sub') userId: string,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() dto: AddParticipantsDto,
  ) {
    return await this.groupService.addGroupTournamentParticipant(
      userId,
      groupId,
      tournamentId,
      dto,
    );
  }

  @UseGuards(JwtGuard)
  @Delete(':groupId/tournaments/:tournamentId/participants/:userId')
  async removeGroupTournamentParticipant(
    @GetUser('sub') userId: string,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('userId') participantId: string,
  ) {
    return await this.groupService.removeGroupTournamentParticipant(
      userId,
      groupId,
      tournamentId,
      participantId,
    );
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments/me')
  // Get my created tournaments
  async getMyCreatedTournaments(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsGroupTournamentDto,
    @Param('groupId') groupId: number,
  ) {
    return this.groupService.getMyTournaments(userId, pageOptions, groupId);
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments/unregistered')
  // Get tournaments that user has not registered (Allow user to participate)
  async getUnregisteredTournaments(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsGroupTournamentDto,
    @Param('groupId') groupId: number,
  ) {
    return this.groupService.getUnregisteredTournaments(
      userId,
      pageOptions,
      groupId,
    );
  }

  @UseGuards(JwtGuard)
  @Post(':groupId/tournaments/:tournamentId/referees')
  // Add referees
  async addReferee(
    @GetUser('sub') userId: string,
    @Body() dto: AddRefereesTournamentDto,
    @Param('tournamentId') tournamentId: number,
    @Param('groupId') groupId: number,
  ) {
    const params: CreateRefereesGroupTournamentDto = {
      email: dto.email,
      groupTournamentId: tournamentId,
    };
    return this.groupService.addReferee(userId, params, groupId);
  }

  @Get(':groupId/tournaments/:tournamentId/referees')
  async getListReferees(
    @Query() pageOptions: PageOptionsRefereesGroupTournamentsDto,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.groupService.listReferees(pageOptions, tournamentId);
  }

  @UseGuards(JwtGuard)
  @Post(':groupId/tournaments/:tournamentId/publish')
  // Publish tournament for user to apply
  async publishTournament(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Param('groupId') groupId: number,
  ) {
    return this.groupService.publishTournament(userId, tournamentId, groupId);
  }

  @UseGuards(JwtGuard)
  @Post(':groupId/tournaments/:tournamentId/unpublish')
  // Unpublish tournament for user to apply
  async unpublishTournament(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Param('groupId') groupId: number,
  ) {
    const unpublish = true;
    return this.groupService.publishTournament(
      userId,
      tournamentId,
      groupId,
      unpublish,
    );
  }

  // @UseGuards(JwtGuard)
  // @Put(':tournamentId')
  // // Update tournament info
  // async updateTournamentInfo(
  //   @GetUser('sub') userId: string,
  //   @Param('tournamentId') tournamentId: number,
  //   @Body() updateDto: UpdateTournamentDto,
  // ) {
  //   return this.groupService.updateTournamentInfo(
  //     userId,
  //     tournamentId,
  //     updateDto,
  //   );
  // }

  @UseGuards(JwtGuard)
  @Post(':groupId/tournaments/:tournamentId/participants/finalize')
  // Finalize applicant list
  async finalizeApplicantList(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Param('groupId') groupId: number,
  ) {
    return this.groupService.finalizeApplicantList(
      tournamentId,
      userId,
      groupId,
    );
  }

  // After finalized
  @Get(':groupId/tournaments/:tournamentId/participants')
  // Get tournament participants
  async getTournamentParticipants(
    @Param('tournamentId') tournamentId: number,
    @Query() pageOptions: PageOptionsTournamentRegistrationDto,
    @Param('groupId') groupId: number,
  ) {
    return this.groupService.getTournamentParticipants(
      tournamentId,
      pageOptions,
      groupId,
    );
  }

  @Post(':groupId/tournaments/:id/fixtures/generate')
  async generateFixture(
    @Param('id') tournamentId: number,
    @Body() dto: GenerateFixtureDto,
  ) {
    try {
      return this.groupService.generateFixture(tournamentId, dto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':groupId/tournaments/:id/fixtures/save-draft')
  async saveDraftFixture(
    @Param('id') tournamentId: number,
    @Body() dto: CreateFixtureDto,
  ) {
    try {
      dto.status = FixtureStatus.draft;
      return this.groupService.createFixture(tournamentId, dto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':groupId/tournaments/:id/fixtures/save-publish')
  async saveFixture(
    @Param('id') tournamentId: number,
    @Body() dto: CreateFixturePublishDto,
  ) {
    try {
      dto.status = FixtureStatus.published;
      return this.groupService.createFixture(tournamentId, dto);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtGuard)
  @Get(':groupId/tournaments/:id/fixtures')
  async getFixture(
    @Param('groupId') groupId: number,
    @Param('id') tournamentId: number,
    @GetUser('sub') userId: string,
  ) {
    try {
      return this.groupService.getByGroupTournamentId(
        tournamentId,
        userId,
        groupId,
      );
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/tournaments/:tournamentId/teams')
  async getAllTeams(
    @Param('tournamentId') tournamentId: number,
    @Query() pageOptions: PageOptionsGroupTournamentDto,
  ) {
    try {
      return this.groupService.getAllTeams(tournamentId, pageOptions);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':groupId/tournaments/:id/fixtures/reset')
  async deleteFixture(@Param('id') tournamentId: number) {
    try {
      return this.groupService.removeByGroupTournamentId(tournamentId);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Internal Server Error',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
