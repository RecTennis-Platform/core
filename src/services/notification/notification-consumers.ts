import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';
import { FcmNotificationService } from './fcm-notification';

@Processor('notification')
export class NotificationConsumer {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly fcmNotificationService: FcmNotificationService,
  ) {}
  @Process()
  async transcode(job: Job<any>) {
    for (const userId of job.data.userIds) {
      // Check if user exists
      const user = await this.prismaService.users.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        console.log(`User ${userId} not found`);
      }
      if (!user.fcmToken) {
        console.log(`User ${userId} does not have fcm token`);
      }
      const token = user.fcmToken;
      const data = {
        params: JSON.stringify({ matchId: 1 }),
        type: 'MATCH_UPDATE',
      };
      const notification = {
        title: 'Test Notification',
        body: 'This is a test message',
      };
      await this.fcmNotificationService.sendingNotificationOneUser(
        token,
        data,
        notification,
      );
    }
    return {};
  }
}
