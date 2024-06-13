import { Module } from '@nestjs/common';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { MailModule } from 'src/services/mail/mail.module';
import { JwtService } from '@nestjs/jwt';
import { JwtInviteUserStrategy } from 'src/auth_utils/strategy';
import { MembershipService } from 'src/membership/membership.service';
import { BullModule } from '@nestjs/bull';
import { SendMailConsumer } from 'src/services/mail/send-mail-consumers';

@Module({
  imports: [
    MailModule,
    BullModule.registerQueue({
      name: 'send-mail',
      redis: process.env.REDIS_URL,
    }),
  ],
  controllers: [GroupController],
  providers: [
    GroupService,
    JwtService,
    JwtInviteUserStrategy,
    MembershipService,
    SendMailConsumer,
  ],
})
export class GroupModule {}
