import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import {Request} from 'express'
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          
          return request?.cookies?.Refresh;
        },
      ]),
      secretOrKey: config.get<string>('REFRESH_TOKEN_SECRET')!,
      passReqToCallback: true, 
    });
  }

  validate(req: Request, payload: any) {
    const refreshToken = req.cookies?.Refresh;
    console.log('Here is refresh strategy, payload:', payload);
    return {
      ...payload,
      refreshToken,
    };
  }
}