import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from 'passport-google-oauth20';
import { AuthService } from "../auth.service";
import { GoogleProfileDto } from "../../dto";
import { ConfigService } from '@nestjs/config';

@Injectable()
export class googleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService,
                private config: ConfigService,
                ) {
        super({
            clientID: config.get('GOOGLE_CLIENT_ID'),
            clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
            callbackURL: config.get('GOOGLE_CALLBACK_URL'),
            scope: ['email', 'profile']
        });
    }

    async validate(accessToken, refreshToken, profile, done) {
        try {
            const googleProfile: GoogleProfileDto = {
                id: profile.id,
                email: profile.emails?.[0]?.value,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                displayName: profile.displayName,
                picture: profile.photos?.[0]?.value,
                emailVerified: profile.emails?.[0]?.verified ?? false,
            };

            if (!googleProfile.email) {
                throw new Error('Email not provided by Google');
            }

            if (!googleProfile.emailVerified) {
                throw new Error('Email not verified by Google');
            }

            const user = await this.authService.validateOAuthLogin(
                googleProfile,
                accessToken,
                refreshToken,
                'google',
            );

            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }
}