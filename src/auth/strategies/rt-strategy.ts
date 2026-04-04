import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../../types';

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  private readonly logger = new Logger(RtStrategy.name, { timestamp: true });

  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.Refresh ?? null,
      ]),
      secretOrKey: config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.cookies?.Refresh;

    if (!refreshToken) {
      this.logger.warn('Refresh token missing from cookie');
      throw new UnauthorizedException('Refresh token not found');
    }

    if (!payload?.sub || !payload?.email) {
      this.logger.warn(
        'RT validation failed — payload missing required fields',
      );
      throw new UnauthorizedException('Invalid token payload');
    }

    this.logger.debug(`Refresh token validated for user: ${payload.sub}`);
    return { ...payload, refreshToken };
  }
}
