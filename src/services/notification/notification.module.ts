import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationConsumer } from './notification-consumers';
import { NotificationProducer } from './notification-producer';
import { FcmNotificationService } from './fcm-notification';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification',
      redis: process.env.REDIS_URL,
    }),
  ],
  providers: [
    NotificationConsumer,
    FcmNotificationService,
    PrismaService,
    NotificationProducer,
  ],
  exports: [NotificationProducer, NotificationConsumer],
})
export class NotificationModule {}
