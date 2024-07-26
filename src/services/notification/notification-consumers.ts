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
        continue;
      }
      if (user.fcmToken && job.data.notiData.mobile) {
        const token = user.fcmToken;
        const data = {
          params: JSON.stringify(job.data.notiData.params),
          type: job.data.notiData.mobileType || job.data.notiData.type,
        };
        console.log('Notidata:', data);
        await this.fcmNotificationService.sendingNotificationOneUser(
          token,
          data,
          job.data.notiData.notification,
        );
      }

      if (job.data.notiData.web) {
        const notification = {
          title: job.data.notiData.notification.title,
          message: job.data.notiData.notification.body,
        };

        await this.prismaService.notifications.create({
          data: {
            type: job.data.notiData.type,
            data: JSON.stringify({
              ...job.data.notiData.params,
              ...notification,
            }),
            userId: userId,
          },
        });
      }
    }
    return {};
  }
}
