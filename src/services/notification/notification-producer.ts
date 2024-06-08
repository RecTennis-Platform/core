import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class NotificationProducer {
  constructor(@InjectQueue('notification') private notificationQueue: Queue) {}

  async add(data: any) {
    await this.notificationQueue.add(data);
  }
}
