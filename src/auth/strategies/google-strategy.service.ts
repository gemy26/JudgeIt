import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { GoogleProfileDto } from '../../dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private logger: Logger = new Logger(GoogleStrategy.name, { timestamp: true });
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    this.logger.debug(
      `Google OAuth callback received for profile: ${profile.id}`,
    );

    try {
      const email = profile.emails?.[0]?.value;
      const emailVerified = profile.emails?.[0]?.verified ?? false;

      if (!email) {
        throw new UnauthorizedException('Email not provided by Google');
      }

      if (!emailVerified) {
        throw new UnauthorizedException('Email not verified by Google');
      }

      const googleProfile: GoogleProfileDto = {
        id: profile.id,
        email,
        firstName: profile.name?.givenName,
        lastName: profile.name?.familyName,
        displayName: profile.displayName,
        picture: profile.photos?.[0]?.value,
        emailVerified,
      };

      this.logger.debug(`Processing OAuth login for: ${email}`);

      const user = await this.authService.validateOAuthLogin(
        googleProfile,
        accessToken,
        refreshToken,
        'google',
      );

      this.logger.debug(`OAuth login successful for user: ${user.id ?? email}`);
      done(null, user);
    } catch (error) {
      this.logger.warn(
        `Google OAuth validation failed — ${(error as Error).message}`,
      );
      done(error as Error, undefined);
    }
  }
}
