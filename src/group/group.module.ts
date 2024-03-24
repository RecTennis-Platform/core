import { Module } from '@nestjs/common';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { MailModule } from 'src/services/mail/mail.module';
import { JwtService } from '@nestjs/jwt';
import { JwtInviteUserStrategy } from 'src/auth_utils/strategy';
import { MembershipService } from 'src/membership/membership.service';

@Module({
  imports: [MailModule],
  controllers: [GroupController],
  providers: [
    GroupService,
    JwtService,
    JwtInviteUserStrategy,
    MembershipService,
  ],
})
export class GroupModule {}
