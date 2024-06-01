import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MatchService } from './match.service';
import { GetUser } from 'src/auth_utils/decorators';
import { JwtGuard } from 'src/auth_utils/guards';

@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get(':id')
  async getMatchDetails(@Param('id') id: string) {
    return await this.matchService.getMatchDetails(id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/start')
  async startMatch(@Param('id') id: string, @GetUser('sub') refereeId: string) {
    return await this.matchService.startMatch(refereeId, id);
  }

  @UseGuards(JwtGuard)
  @Post(':id/end')
  async endMatch(@Param('id') id: string, @GetUser('sub') refereeId: string) {
    return await this.matchService.endMatch(refereeId, id);
  }
}
