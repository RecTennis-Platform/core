import { Inject, Injectable } from '@nestjs/common';
import { AwsSesService } from '../aws-ses/aws-ses.service';
import {
  SendTemplatedEmailCommand,
  SendTemplatedEmailCommandInput,
} from '@aws-sdk/client-ses';
import { SendMailTemplateDto } from './mail.dto';

@Injectable()
export class MailService {
  constructor(
    @Inject(AwsSesService)
    private readonly awsSesService: AwsSesService,
  ) {}

  async sendEmailTemplate(payload: SendMailTemplateDto) {
    const input: SendTemplatedEmailCommandInput = {
      // SendTemplatedEmailRequest
      Source: process.env.SOURCE_EMAIL, // email sending template
      Destination: {
        // Destination
        ToAddresses: payload.toAddresses,
        CcAddresses: payload.ccAddresses ?? [],
        BccAddresses: payload.bccAddresses ?? [],
      },
      ReplyToAddresses: [],
      SourceArn: null,
      ReturnPathArn: null,

      ConfigurationSetName: null,
      Template: payload.template, // required
      TemplateArn: null,
      TemplateData: payload.templateData, // required
    };
    const command = new SendTemplatedEmailCommand(input);
    await this.awsSesService.getSesClient().send(command);
  }
}
