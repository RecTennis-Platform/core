import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { FormatTournamentService } from 'src/services/format_tournament/format_tournament.service';
import { FixtureService } from 'src/fixture/fixture.service';
import { RefereesTournamentsService } from 'src/referees_tournaments/referees_tournaments.service';
import { FcmNotificationService } from 'src/services/notification/fcm-notification';
import { NotificationModule } from 'src/services/notification/notification.module';

@Module({
  controllers: [TournamentController],
  providers: [
    TournamentService,
    FormatTournamentService,
    FixtureService,
    RefereesTournamentsService,
    FcmNotificationService,
  ],
  exports: [TournamentService],
  imports: [NotificationModule],
})
export class TournamentModule {}
