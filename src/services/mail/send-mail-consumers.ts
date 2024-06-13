import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { MailService } from './mail.service';

@Processor('send-mail')
export class SendMailConsumer {
  constructor(private readonly mailService: MailService) {}
  @Process()
  async transcode(job: Job<any>) {
    await this.mailService.sendEmailTemplate(job.data);
  }
}
