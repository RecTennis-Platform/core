import {
  Body,
  Controller,
  Get,
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
import { JwtGuard } from 'src/auth_utils/guards';
import { GetUser } from 'src/auth_utils/decorators';

@Controller('tournaments')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  // Tournaments
  @Get()
  async getParticipatedTournaments() {}

  @UseGuards(JwtGuard)
  @Get(':tournamentId/general-info')
  async getTournamentDetails(
    @GetUser('sub') userId: number,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.getTournamentDetails(userId, tournamentId);
  }

  @Get('')
  async getTournamentParticipants() {}

  @UseGuards(JwtGuard)
  @Get('/me')
  async getMyTournaments(
    @GetUser('sub') userId: number,
    @Query() pageOptionsTournamentDto: PageOptionsTournamentDto,
  ) {
    return this.tournamentService.getMyTournaments(
      userId,
      pageOptionsTournamentDto,
    );
  }

  @UseGuards(JwtGuard)
  @Post()
  async createTournament(
    @GetUser('sub') userId: number,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentService.createTournament(userId, dto);
  }

  @UseGuards(JwtGuard)
  @Patch(':tournamentId/publish')
  async publishTournament(
    @GetUser('sub') userId: number,
    @Param('tournamentId') tournamentId: number,
  ) {
    return this.tournamentService.publishTournament(userId, tournamentId);
  }

  // Participants
  // For Creator
  @Get(':tournamentId/applicants')
  async getApplicantsList() {}

  // For Applicant
  @UseGuards(JwtGuard)
  @Post(':tournamentId/applicants/apply')
  async submitApplication(
    @GetUser('sub') userId: number,
    @Param('tournamentId') tournamentId: number,
    @Body() dto: CreateApplyApplicantDto,
  ) {
    return this.tournamentService.submitApplication(userId, tournamentId, dto);
  }
}
