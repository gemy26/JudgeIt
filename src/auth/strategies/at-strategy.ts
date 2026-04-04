import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../../types';
import { Role } from '@prisma/client';

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(AtStrategy.name, { timestamp: true });

  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.Authentication ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    if (!payload?.sub || !payload?.email) {
      this.logger.warn(
        'JWT validation failed — payload missing required fields',
      );
      throw new UnauthorizedException('Invalid token payload');
    }

    this.logger.debug(
      `JWT validated for user: ${payload.sub} (${payload.email})`,
    );

    return {
      ...payload,
      roles: payload.roles ?? [Role.USER],
    };
  }
}
