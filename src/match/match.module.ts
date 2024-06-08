import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { BullModule } from '@nestjs/bull';
import { NotificationProducer } from 'src/services/notification/notification-producer';
import { NotificationConsumer } from 'src/services/notification/notification-consumers';
import { FcmNotificationService } from 'src/services/notification/fcm-notification';

@Module({
  controllers: [MatchController],
  providers: [
    MatchService,
    NotificationProducer,
    NotificationConsumer,
    FcmNotificationService,
  ],
  exports: [MatchService],
  imports: [
    BullModule.registerQueue({
      name: 'notification',
      redis: process.env.REDIS_URL,
    }),
  ],
})
export class MatchModule {}
