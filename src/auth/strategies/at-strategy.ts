import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from '../../types';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(private config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get<string>('ACCESS_TOKEN_SECRET')!
        });
    }
    validate(payload: JwtPayload) {
        console.log('Here is validate function of At-Strategy and thats the payload: ', payload);
        return payload
    }
}