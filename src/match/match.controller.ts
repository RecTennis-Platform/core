import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { MatchService } from './match.service';
import { GetUser } from 'src/auth_utils/decorators';
import { JwtGuard } from 'src/auth_utils/guards';
import {
  StartMatchDto,
  StartSetDto,
  UpdateMatchDto,
  UpdateScoreDto,
} from './dto';

@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @UseGuards(JwtGuard)
  @Get(':id')
  async getMatchDetails(
    @Param('id') id: string,
    @GetUser('sub') userId: string,
  ) {
    return await this.matchService.getMatchDetails(id, userId);
  }

  @UseGuards(JwtGuard)
  @Patch(':id')
  async updateMatch(
    @Param('id') matchId: string,
    @GetUser('sub') userId: string,
    @Body() dto: UpdateMatchDto,
  ) {
    return await this.matchService.updateMatch(matchId, userId, dto);
  }

  // Referee
  @UseGuards(JwtGuard)
  @Post(':id/start')
  async startMatch(
    @Param('id') matchId: string,
    @GetUser('sub') refereeId: string,
    @Body() dto: StartMatchDto,
  ) {
    return await this.matchService.startMatch(
      matchId,
      refereeId,
      dto.teamServeId,
    );
  }

  @UseGuards(JwtGuard)
  @Post(':id/sets/start')
  async startSet(
    @Param('id') matchId: string,
    @GetUser('sub') refereeId: string,
    @Body() dto: StartSetDto,
  ) {
    return await this.matchService.startSet(
      matchId,
      refereeId,
      dto.teamServeId,
    );
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
