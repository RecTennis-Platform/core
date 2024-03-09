import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { AwsSesModule } from '../aws-ses/aws-ses.module';

@Module({
  imports: [AwsSesModule],
  exports: [MailService],
  providers: [MailService],
})
export class MailModule {}
