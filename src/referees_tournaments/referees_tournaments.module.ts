import { Module } from '@nestjs/common';
import { RefereesTournamentsService } from './referees_tournaments.service';
import { RefereesTournamentsController } from './referees_tournaments.controller';

@Module({
  controllers: [RefereesTournamentsController],
  providers: [RefereesTournamentsService],
})
export class RefereesTournamentsModule {}
