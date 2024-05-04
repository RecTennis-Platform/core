import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { FormatTournamentService } from 'src/services/format_tournament/format_tournament.service';
import { FixtureService } from 'src/fixture/fixture.service';

@Module({
  controllers: [TournamentController],
  providers: [TournamentService, FormatTournamentService, FixtureService],
})
export class TournamentModule {}
