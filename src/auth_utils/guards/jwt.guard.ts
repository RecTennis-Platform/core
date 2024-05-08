import { AuthGuard } from '@nestjs/passport';

export class JwtGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }
}

export class OptionalJwtGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }

  // Override handleRequest method to allow request with no
  handleRequest(err, user, info, context) {
    if (err || !user) {
      return false;
    }
    return user;
  }
}

export class JwtInviteUserGuard extends AuthGuard('jwt-invite-user') {
  constructor() {
    super();
  }
}
