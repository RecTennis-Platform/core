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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TournamentService } from './tournament.service';
import {
  CreateApplyApplicantDto,
  CreateTournamentDto,
  PageOptionsTournamentDto,
  PageOptionsTournamentRegistrationDto,
  UpdateTournamentDto,
} from './dto';
import { JwtGuard, OptionalJwtGuard } from 'src/auth_utils/guards';
import { GetUser } from 'src/auth_utils/decorators';
import {
  CreateFixtureDto,
  GenerateFixtureDto,
  GenerateFixtureKnockoutDto,
} from 'src/fixture/dto/create-fixture.dto';
import { CreateFixtureGroupPlayoffDto } from 'src/fixture/dto/create-fixture-groupplayoff.dto';
import { FixtureService } from 'src/fixture/fixture.service';
import { CreateRefereesTournamentDto } from 'src/referees_tournaments/dto/create-referees_tournament.dto';
import { AddRefereesTournamentDto } from './dto/create-referees_tournament.dto';
import { PageOptionsRefereesTournamentsDto } from 'src/referees_tournaments/dto/page-options-referees-tournaments.dto';
import { FcmNotificationService } from 'src/services/notification/fcm-notification';
import { SelectSeedDto } from './dto/select-seed.dto';
import {
  CreateTournamentFundDto,
  UpdateTournamentFundByCreatorDto,
  UpdateTournamentFundDto,
} from './dto/create-fund.dto';
import { CreatePaymentInfoDto } from './dto/create-payment-info.dto';
import { PageOptionsTournamentFundDto } from './dto/page-options-tournament-fund.dto';
import {
  CreateFixturePublishDto,
  CreateFixturePublishKnockoutDto,
} from 'src/fixture/dto/create-fixture-save-publish.dto';
import { FixtureStatus } from '@prisma/client';
import { UpdatePaymentInfoDto } from './dto/update-payment-info.dto';

@Controller('tournaments')
export class TournamentController {
  constructor(
    private readonly tournamentService: TournamentService,
    private readonly fixtureService: FixtureService,
    private readonly fcmNotificationService: FcmNotificationService,
  ) {}

  // **Tournaments
  @Get()
  // Fetch all tournaments
  async fetchTournaments(@Query() pageOptions: PageOptionsTournamentDto) {
    return this.tournamentService.getTournamentsList(pageOptions);
  }

  @UseGuards(OptionalJwtGuard) // Use this when endpoint allow both authenticated and unauthenticated users
  @Get(':tournamentId/general-info')
  // Get tournament general info
  async getTournamentDetails(
    @GetUser('sub') userId: string | undefined,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.getTournamentDetails(userId, tournamentId);
  }

  @UseGuards(JwtGuard)
  @Get('me')
  // Get my created tournaments
  async getMyCreatedTournaments(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsTournamentDto,
  ) {
    return this.tournamentService.getMyTournaments(userId, pageOptions);
  }

  @UseGuards(JwtGuard)
  @Get('unregistered')
  // Get tournaments that user has not registered (Allow user to participate)
  async getUnregisteredTournaments(
    @GetUser('sub') userId: string,
    @Query() pageOptions: PageOptionsTournamentDto,
  ) {
    return this.tournamentService.getUnregisteredTournaments(
      userId,
      pageOptions,
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
  @Post(':tournamentId/referees')
  // Add referees
  async addReferee(
    @GetUser('sub') userId: string,
    @Body() dto: AddRefereesTournamentDto,
    @Param('tournamentId') tournamentId: number,
  ) {
    const params: CreateRefereesTournamentDto = {
      email: dto.email,
      tournamentId: tournamentId,
    };
    return this.tournamentService.addReferee(userId, params);
  }

  @Get(':tournamentId/referees')
  async getListReferees(
    @Query() pageOptions: PageOptionsRefereesTournamentsDto,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.listReferees(pageOptions, tournamentId);
  }

  @UseGuards(JwtGuard)
  @Post(':tournamentId/publish')
  // Publish tournament for user to apply
  async publishTournament(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.publishTournament(userId, tournamentId);
  }

  @UseGuards(JwtGuard)
  @Post(':tournamentId/unpublish')
  // Unpublish tournament for user to apply
  async unpublishTournament(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
  ) {
    const unpublish = true;
    return this.tournamentService.publishTournament(
      userId,
      tournamentId,
      unpublish,
    );
  }

  @UseGuards(JwtGuard)
  @Put(':tournamentId')
  // Update tournament info
  async updateTournamentInfo(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body() updateDto: UpdateTournamentDto,
  ) {
    return this.tournamentService.updateTournamentInfo(
      userId,
      tournamentId,
      updateDto,
    );
  }

  // **Participants
  // ****For Creator
  @UseGuards(JwtGuard)
  @Get(':tournamentId/applicants')
  // Get applicants list
  async getApplicantsList(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Query() pageOptions: PageOptionsTournamentRegistrationDto,
  ) {
    return this.tournamentService.getApplicantsList(
      userId,
      tournamentId,
      pageOptions,
    );
  }

  @UseGuards(JwtGuard)
  @Post(':tournamentId/applicants/approve')
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
  @Post(':tournamentId/applicants/seeds')
  // Approve applicant
  async selectSeed(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body() dto: SelectSeedDto,
  ) {
    return this.tournamentService.selectSeed(tournamentId, userId, dto);
  }

  @UseGuards(JwtGuard)
  @Post(':tournamentId/applicants/reject')
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
  @Post(':tournamentId/applicants/finalize')
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
    @Query() pageOptions: PageOptionsTournamentRegistrationDto,
  ) {
    return this.tournamentService.getTournamentParticipants(
      tournamentId,
      pageOptions,
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
    @Query() pageOptions: PageOptionsTournamentRegistrationDto,
  ) {
    return this.tournamentService.getTournamentInvitations(
      userId,
      tournamentId,
      pageOptions,
    );
  }

  @UseGuards(JwtGuard)
  @Post(':tournamentId/applicants/invitations/accept')
  // Accept invitation
  async acceptInvitation(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body('inviterId') inviterId: string,
  ) {
    return this.tournamentService.acceptInvitation(
      userId,
      tournamentId,
      inviterId,
    );
  }

  @UseGuards(JwtGuard)
  @Post(':tournamentId/applicants/invitations/reject')
  // Reject invitation
  async rejectInvitation(
    @GetUser('sub') userId: string,
    @Param('tournamentId') tournamentId: number,
    @Body('inviterId') inviterId: string,
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

  @Post('/:id/knockout-fixtures/generate')
  async generateKnockoutFixture(
    @Param('id') tournamentId: number,
    @Body() dto: GenerateFixtureKnockoutDto,
  ) {
    try {
      return this.tournamentService.generateFixtureKnockout(tournamentId, dto);
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

  @Post('/:id/knockout-fixtures/save')
  async saveKnockoutFixture(
    @Param('id') tournamentId: number,
    @Body() dto: CreateFixturePublishKnockoutDto,
  ) {
    try {
      return this.tournamentService.createFixtureKnockout(tournamentId, dto);
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

  @Post('/:id/fixtures/save-draft')
  async saveFixture(
    @Param('id') tournamentId: number,
    @Body() dto: CreateFixtureDto,
  ) {
    try {
      dto.status = FixtureStatus.draft;
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

  @Post('/:id/fixtures/save-publish')
  async saveFixturePublish(
    @Param('id') tournamentId: number,
    @Body() dto: CreateFixturePublishDto,
  ) {
    try {
      dto.status = FixtureStatus.published;
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

  @UseGuards(JwtGuard)
  @Get('/:id/fixtures')
  async getFixture(
    @Param('id') tournamentId: number,
    @GetUser('sub') userId: string,
  ) {
    try {
      return this.fixtureService.getByTournamentId(tournamentId, userId);
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

  @Get('/:id/teams')
  async getAllTeams(
    @Param('id') tournamentId: number,
    @Query() pageOptions: PageOptionsTournamentDto,
  ) {
    try {
      return this.tournamentService.getAllTeams(tournamentId, pageOptions);
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

  @UseGuards(JwtGuard)
  @Get('/:tournamentId/payment-info')
  async getTournamentPaymentInfo(
    @Param('tournamentId') tournamentId: number,
    //@GetUser('sub') userId: string,
  ) {
    try {
      return this.tournamentService.getTournamentPaymentInfo(tournamentId);
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
  @Get('/:tournamentId/noti')
  async getNoti(
    @Param('tournamentId') tournamentId: number,
    @GetUser('sub') userId: string,
  ) {
    try {
      return this.tournamentService.getNoti(tournamentId, userId);
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
  @Post('/:tournamentId/fund')
  async updateFundByUser(
    @Param('tournamentId') tournamentId: number,
    @GetUser('sub') userId: string,
    @Body() dto: UpdateTournamentFundDto,
  ) {
    try {
      dto.userId = userId;
      return this.tournamentService.updateFundByUser(tournamentId, dto);
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
  @Get('/:tournamentId/fund')
  async getFundByUser(
    @Param('tournamentId') tournamentId: number,
    @GetUser('sub') userId: string,
  ) {
    try {
      return this.tournamentService.getUserFund(tournamentId, userId);
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

  //Creator
  @UseGuards(JwtGuard)
  @Post('/:tournamentId/payment-info')
  async createTournamentPaymentInfo(
    @Param('tournamentId') tournamentId: number,
    @GetUser('sub') userId: string,
    @Body() dto: CreatePaymentInfoDto,
  ) {
    try {
      return this.tournamentService.createTournamentPaymentInfo(
        tournamentId,
        userId,
        dto,
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

  @UseGuards(JwtGuard)
  @Patch('/:tournamentId/payment-info')
  async updateTournamentPaymentInfo(
    @Param('tournamentId') tournamentId: number,
    @GetUser('sub') userId: string,
    @Body() dto: UpdatePaymentInfoDto,
  ) {
    try {
      return this.tournamentService.updatePaymentInfo(
        tournamentId,
        userId,
        dto,
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

  @UseGuards(JwtGuard)
  @Get('/:tournamentId/fund/users')
  async getListOfUserFund(
    @Param('tournamentId') tournamentId: number,
    @GetUser('sub') userId: string,
    @Query() dto: PageOptionsTournamentFundDto,
  ) {
    try {
      return this.tournamentService.getAllUserFunds(dto, tournamentId, userId);
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

  // @UseGuards(JwtGuard)
  // @Post('/:tournamentId/fund/users')
  // async sendRefundToUser(
  //   @Param('tournamentId') tournamentId: number,
  //   @GetUser('sub') userId: string,
  //   @Body() dto: CreateTournamentFundDto,
  // ) {
  //   try {
  //     return this.tournamentService.sendFund2User(tournamentId, userId, dto);
  //   } catch (error) {
  //     throw new HttpException(
  //       {
  //         statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
  //         message: error.message || 'Internal Server Error',
  //       },
  //       error.status || HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  @UseGuards(JwtGuard)
  @Patch('/:tournamentId/fund/users')
  async updateFundByCreator(
    @Param('tournamentId') tournamentId: number,
    @GetUser('sub') userId: string,
    @Body() dto: UpdateTournamentFundByCreatorDto,
  ) {
    try {
      return this.tournamentService.updateFundByCreator(
        tournamentId,
        userId,
        dto,
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
}
