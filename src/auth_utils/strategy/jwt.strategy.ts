import { ForbiddenException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ITokenPayload } from '../interfaces/ITokenPayload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // Use custom validation instead
      secretOrKey: process.env.JWT_AT_SECRET,
    });
  }

  async validate(payload: ITokenPayload) {
    const { exp } = payload;

    // Check if the token is expired
    if (Date.now() >= exp * 1000) {
      throw new ForbiddenException('Token has expired');
    }

    return {
      ...payload,
    };
  }
}
