import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtStrategy } from 'src/auth_utils/strategy';
import { TournamentModule } from 'src/tournament/tournament.module';
import { FcmNotificationService } from 'src/services/notification/fcm-notification';

@Module({
  controllers: [UserController],
  providers: [UserService, JwtStrategy, FcmNotificationService],
  imports: [TournamentModule],
})
export class UserModule {}
