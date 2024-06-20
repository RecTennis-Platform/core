import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MatchService } from './match.service';
import { GetUser } from 'src/auth_utils/decorators';
import { JwtGuard } from 'src/auth_utils/guards';
import { UpdateScoreDto } from './dto';

@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get(':id')
  async getMatchDetails(@Param('id') id: string) {
    return await this.matchService.getMatchDetails(id);
  }

  // Referee
  @UseGuards(JwtGuard)
  @Post(':id/start')
  async startMatch(
    @Param('id') matchId: string,
    @GetUser('sub') refereeId: string,
  ) {
    return await this.matchService.startMatch(matchId, refereeId);
  }

  @UseGuards(JwtGuard)
  @Post(':id/sets/start')
  async startSet(
    @Param('id') matchId: string,
    @GetUser('sub') refereeId: string,
  ) {
    return await this.matchService.startSet(matchId, refereeId);
  }

  @UseGuards(JwtGuard)
  @Post(':id/update-score')
  async updateScore(
    @Param('id') matchId: string,
    @GetUser('sub') refereeId: string,
    @Body() dto: UpdateScoreDto,
  ) {
    return await this.matchService.updateScore(matchId, refereeId, dto);
  }
}
