import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from '../../types';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';


@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(private config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
              (request: Request) => {
                return request?.cookies?.Authentication;  
              }
            ]),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('ACCESS_TOKEN_SECRET')!
        });
    }
    validate(payload: JwtPayload) {
        console.log('Here is validate function of At-Strategy and thats the payload: ', payload);
      return {
        ...payload,
        roles: (payload as any).roles || []
      };
    }
}