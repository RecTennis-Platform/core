import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { FormatTournamentService } from 'src/services/format_tournament/format_tournament.service';

@Module({
  controllers: [TournamentController],
  providers: [TournamentService, FormatTournamentService],
})
export class TournamentModule {}
