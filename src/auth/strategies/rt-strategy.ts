import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import {Request} from 'express'
import { ConfigService } from '@nestjs/config';
@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(private config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.get<string>("REFRESH_TOKEN_SECRET")!,
            passReqToCallback: true
        });
    }
    validate(req: Request, payload: any) {
        console.log('Here is refresh strategy')
        const authHeader = req.get('Authorization');
        const refreshToken = authHeader?.split(' ')[1];
        return {
            ...payload,
            refreshToken
        }
    }
}