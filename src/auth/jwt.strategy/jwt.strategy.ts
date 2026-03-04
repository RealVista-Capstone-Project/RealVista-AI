import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../ai/interfaces/jwt-payload.interface.js';
import { UserContext } from '../../ai/interfaces/user-context.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'super-secret-key-change-in-production',
    });
  }

  validate(payload: JwtPayload): UserContext {
    if (!payload) {
      throw new UnauthorizedException('Invalid token payload');
    }
    // Extract contextual information from the backend JWT token
    // Our microservice uses this payload for AI Tool calls instead of
    // doing its own DB lookup for the user
    return {
      sub: payload.sub,
      username: payload.username,
      roles: payload.roles || [],
    };
  }
}
