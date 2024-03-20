import { Module } from '@nestjs/common';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { MailModule } from 'src/services/mail/mail.module';
import { JwtService } from '@nestjs/jwt';
import { JwtInviteUserStrategy } from 'src/auth_utils/strategy';

@Module({
  imports: [MailModule],
  controllers: [GroupController],
  providers: [GroupService, JwtService, JwtInviteUserStrategy],
})
export class GroupModule {}
