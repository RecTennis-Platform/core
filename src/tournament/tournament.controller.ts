import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TournamentService } from './tournament.service';
import {
  CreateApplyApplicantDto,
  CreateTournamentDto,
  PageOptionsTournamentDto,
} from './dto';
import { JwtGuard, RolesGuard } from 'src/auth_utils/guards';
import { GetUser, Roles } from 'src/auth_utils/decorators';
import { UserRole } from '@prisma/client';
import {
  CreateFixtureDto,
  GenerateFixtureDto,
} from 'src/fixture/dto/create-fixture.dto';
import { CreateFixtureGroupPlayoffDto } from 'src/fixture/dto/create-fixture-groupplayoff.dto';
import { FixtureService } from 'src/fixture/fixture.service';

@Controller('tournaments')
export class TournamentController {
  constructor(
    private readonly tournamentService: TournamentService,
    private readonly fixtureService: FixtureService,
  ) {}

  // **Tournaments
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get()
  // Fetch all tournaments - For admin
  async fetchTournaments(@Query() pageOptions: PageOptionsTournamentDto) {
    return this.tournamentService.getTournamentsList(pageOptions);
  }

  @UseGuards(JwtGuard)
  @Get(':tournamentId/general-info')
  // Get tournament general info
  async getTournamentDetails(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.getTournamentDetails(userId, tournamentId);
  }

  @UseGuards(JwtGuard)
  @Get('/me')
  // Get my created tournaments
  async getMyCreatedTournaments(
    @GetUser('sub') userId: string,
    @Query() pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
    return this.tournamentService.getMyTournaments(
      userId,
      pageOptionsTournamentDto,
    );
  }

  @UseGuards(JwtGuard)
  @Post()
  // Create tournament
  async createTournament(
    @GetUser('sub') userId: string,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentService.createTournament(userId, dto);
  }

  @UseGuards(JwtGuard)
  @Patch(':tournamentId/publish')
  // Publish tournament for user to apply
  async publishTournament(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.publishTournament(userId, tournamentId);
  }

  // **Participants
  // ****For Creator
  @UseGuards(JwtGuard)
  @Get(':tournamentId/applicants')
  // Get applicants list
  async getApplicantsList(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Query() pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
    return this.tournamentService.getApplicantsList(
      userId,
      tournamentId,
      pageOptionsTournamentDto,
    );
  }

  @UseGuards(JwtGuard)
  @Patch(':tournamentId/applicants/approve')
  // Approve applicant
  async approveApplicant(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body('userId') applicantId: string,
  ) {
    return this.tournamentService.approveApplicant(
      tournamentId,
      userId,
      applicantId,
    );
  }

  @UseGuards(JwtGuard)
  @Patch(':tournamentId/applicants/reject')
  // Reject applicant
  async rejectApplicant(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body('userId') applicantId: string,
  ) {
    return this.tournamentService.rejectApplicant(
      tournamentId,
      userId,
      applicantId,
    );
  }

  @UseGuards(JwtGuard)
  @Patch(':tournamentId/applicants/finalize')
  // Finalize applicant list
  async finalizeApplicantList(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.finalizeApplicantList(tournamentId, userId);
  }

  // After finalized
  @Get(':tournamentId/participants')
  // Get tournament participants
  async getTournamentParticipants(
    @Param('tournamentId') tournamentId: number,
    @Query() pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
    return this.tournamentService.getTournamentParticipants(
      tournamentId,
      pageOptionsTournamentDto,
    );
  }

  // **For Applicant
  @UseGuards(JwtGuard)
  @Get(':tournamentId/applicants/apply')
  // Get submitted applications
  async getSubmittedApplications(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.getSubmittedApplications(
      userId,
      tournamentId,
    );
  }

  @UseGuards(JwtGuard)
  @Post(':tournamentId/applicants/apply')
  // Submit application
  async submitApplication(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body() dto: CreateApplyApplicantDto,
  ) {
    return this.tournamentService.submitApplication(userId, tournamentId, dto);
  }

  @UseGuards(JwtGuard)
  @Delete(':tournamentId/applicants/apply')
  // Cancel application
  async cancelApplication(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.cancelApplication(userId, tournamentId);
  }

  @UseGuards(JwtGuard)
  @Get(':tournamentId/applicants/invitations')
  // Get tournament invitations
  async getTournamentInvitations(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Query() pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
    return this.tournamentService.getTournamentInvitations(
      userId,
      tournamentId,
      pageOptionsTournamentDto,
    );
  }

  @UseGuards(JwtGuard)
  @Patch(':tournamentId/applicants/invitations/accept')
  // Accept invitation
  async acceptInvitation(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body('inviterId') inviterId: number,
  ) {
    return this.tournamentService.acceptInvitation(
      userId,
      tournamentId,
      inviterId,
    );
  }

  @UseGuards(JwtGuard)
  @Patch(':tournamentId/applicants/invitations/reject')
  // Reject invitation
  async rejectInvitation(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body('inviterId') inviterId: number,
  ) {
    return this.tournamentService.rejectInvitation(
      userId,
      tournamentId,
      inviterId,
    );
  }

  @Post('/:id/fixtures/generate')
  async generateFixture(
    @Param('id') tournamentId: number,
    @Body() dto: GenerateFixtureDto,
  ) {
    try {
      return this.tournamentService.generateFixture(tournamentId, dto);
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

  @Post('/:id/fixture-groups/generate')
  async generateFixtureGroup(
    @Param('id') tournamentId: number,
    @Body() dto: CreateFixtureGroupPlayoffDto,
  ) {
    try {
      return this.tournamentService.generateFixtureGroup(tournamentId, dto);
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

  @Post('/:id/fixtures/save')
  async saveFixture(
    @Param('id') tournamentId: number,
    @Body() dto: CreateFixtureDto,
  ) {
    try {
      return this.tournamentService.createFixture(tournamentId, dto);
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

  @Get('/:id/fixtures')
  async getFixture(@Param('id') tournamentId: number) {
    try {
      return this.fixtureService.getByTournamentId(tournamentId);
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

  @Delete('/:id/fixtures/reset')
  async deleteFixture(@Param('id') tournamentId: number) {
    try {
      return this.fixtureService.removeByTournamentId(tournamentId);
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
