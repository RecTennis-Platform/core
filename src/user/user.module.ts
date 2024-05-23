import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtStrategy } from 'src/auth_utils/strategy';
import { TournamentModule } from 'src/tournament/tournament.module';

@Module({
  controllers: [UserController],
  providers: [UserService, JwtStrategy],
  imports: [TournamentModule],
})
export class UserModule {}
