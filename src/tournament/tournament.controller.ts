import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { CreateTournamentDto } from './dto';
import { JwtGuard } from 'src/auth_utils/guards';
import { GetUser } from 'src/auth_utils/decorators';

@Controller('tournaments')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @UseGuards(JwtGuard)
  @Post()
  async createTournament(
    @GetUser('sub') UserId: number,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentService.createTournament(UserId, dto);
  }
}
