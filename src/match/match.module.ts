import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { FcmNotificationService } from 'src/services/notification/fcm-notification';
import { NotificationModule } from 'src/services/notification/notification.module';

@Module({
  controllers: [MatchController],
  providers: [MatchService, FcmNotificationService],
  exports: [MatchService],
  imports: [NotificationModule],
})
export class MatchModule {}
