import { AuthGuard } from '@nestjs/passport';

export class JwtGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }
}

export class JwtInviteUserGuard extends AuthGuard('jwt-invite-user') {
  constructor() {
    super();
  }
}
