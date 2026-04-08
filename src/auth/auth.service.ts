import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GoogleProfileDto,
  AuthDto,
  MailDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '../dto';
import { UsersService } from 'src/users/users.service';
import * as argon2 from 'argon2';
import { Tokens } from '../types';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PasswordResetRepository } from './password-reset.repository';
import { addMinutes } from 'date-fns';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  private logger: Logger = new Logger(AuthService.name, { timestamp: true });
  constructor(
    private usersService: UsersService,
    private passwordResetRepository: PasswordResetRepository,
    private emailService: EmailService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async updateRtHash(userId: number, rt: string) {
    this.logger.debug(`Updating refresh token hash for user: ${userId}`);
    const hashedRt = await argon2.hash(rt);
    await this.usersService.updateRtHash(userId, hashedRt);
    this.logger.debug(`Refresh token hash updated for user: ${userId}`);
  }

  async getTokens(
    userId: number,
    email: string,
    roles: Role[],
  ): Promise<Tokens> {
    this.logger.debug(`Generating tokens for user: ${userId} (${email})`);
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          roles: roles,
        },
        {
          secret: this.config.get('ACCESS_TOKEN_SECRET'),
          expiresIn: this.config.get('ACCESS_TOKEN_EXPIRATION'),
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          roles: roles,
        },
        {
          secret: this.config.get('REFRESH_TOKEN_SECRET'),
          expiresIn: this.config.get('REFRESH_TOKEN_EXPIRATION'),
        },
      ),
    ]);

    this.logger.debug(`Tokens generated for user: ${userId}`);
    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  async register(dto: AuthDto): Promise<Tokens> {
    this.logger.log(`Registering new user with email: ${dto.email}`);
    const hashedPassword = await argon2.hash(dto.password);
    const user = await this.usersService.createUser({
      ...dto,
      password: hashedPassword,
    });

    this.logger.log(`User registered successfully — id: ${user.id}`);

    const tokens: Tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRtHash(user.id, tokens.refresh_token);

    return tokens;
  }

  async login(dto: AuthDto): Promise<Tokens> {
    const { email, password } = dto;
    this.logger.log(`Login attempt for email: ${email}`);

    const user = await this.usersService.findUser(dto);

    if (!user) {
      this.logger.warn(`Login failed — user not found: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const hasOAuthAccount = await this.usersService.hasAccount(email);
    if (!user.hash && hasOAuthAccount) {
      this.logger.warn(
        `Login failed — OAuth account attempted password login: ${email}`,
      );
      throw new ForbiddenException(
        'This account uses OAuth login. Please sign in with Google.',
      );
    }

    const isValidPassword = await argon2.verify(user.hash!, password);
    if (!isValidPassword) {
      this.logger.warn(`Login failed — invalid password for user: ${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in successfully — id: ${user.id}`);
    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRtHash(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: number) {
    this.logger.log(`Logging out user: ${userId}`);
    await this.usersService.deleteRt(userId);
    this.logger.log(`User logged out successfully — id: ${userId}`);
  }

  async refreshTokens(userId: number, rt: string): Promise<Tokens> {
    this.logger.debug(`Refreshing tokens for user: ${userId}`);

    const user = await this.usersService.findById(userId);
    if (!user || !user.hashedRt) {
      this.logger.warn(
        `Token refresh failed — user not found or no RT hash: ${userId}`,
      );
      throw new ForbiddenException('Access denied');
    }

    const rtMatches = await argon2.verify(user.hashedRt, rt);
    if (!rtMatches) {
      this.logger.warn(
        `Token refresh failed — RT mismatch for user: ${userId}`,
      );
      throw new ForbiddenException('Access denied');
    }

    this.logger.debug(`Tokens refreshed successfully for user: ${userId}`);

    const tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRtHash(user.id, tokens.refresh_token);

    return tokens;
  }

  async validateOAuthLogin(
    googleProfile: GoogleProfileDto,
    accessToken: string,
    refreshToken: string,
    provider: string,
  ) {
    const { email, emailVerified, id } = googleProfile;
    this.logger.debug(
      `Validating OAuth login — provider: ${provider}, profileId: ${id}`,
    );

    if (!email) {
      this.logger.warn(
        `OAuth login failed — no email from provider: ${provider}`,
      );
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    if (!emailVerified) {
      this.logger.warn(`OAuth login failed — email not verified: ${email}`);
      throw new UnauthorizedException(
        'Please verify your email with the OAuth provider first',
      );
    }

    const account = await this.usersService.findAccountByProvider(
      provider,
      googleProfile.id,
    );

    if (account) {
      this.logger.debug(
        `Existing OAuth account found — updating tokens: ${email}`,
      );
      await this.usersService.updateOauthAccount(
        account,
        accessToken,
        refreshToken,
      );
      return account.user;
    }

    const user = await this.usersService.findByEmail(googleProfile.email);
    if (user) {
      this.logger.debug(`Linking OAuth to existing user: ${email}`);
      await this.usersService.linkOauthUser(
        user,
        provider,
        googleProfile,
        accessToken,
        refreshToken,
      );
      return user;
    }

    this.logger.log(
      `Creating new OAuth user — provider: ${provider}, email: ${email}`,
    );
    return this.usersService.createOauthUser(
      provider,
      googleProfile,
      accessToken,
      refreshToken,
    );
  }

  async changePassword(id: number, dto: ChangePasswordDto): Promise<void> {
    const { oldPass, newPass } = dto;
    this.logger.log(`Password change requested for user: ${id}`);

    const user = await this.usersService.findById(id);
    if (!user) {
      this.logger.warn(`Password change failed — user not found: ${id}`);
      throw new NotFoundException('User not found');
    }

    const hasOAuthAccount = await this.usersService.hasAccount(user.email);
    if (hasOAuthAccount) {
      this.logger.warn(
        `Password change failed — OAuth user attempted password change: ${id}`,
      );
      throw new BadRequestException('OAuth accounts cannot change password');
    }

    if (!user.hash) {
      this.logger.warn(
        `Password change failed — no password hash for user: ${id}`,
      );
      throw new BadRequestException('User has no password set');
    }

    const isValidPass = await argon2.verify(user.hash, oldPass);
    if (!isValidPass) {
      this.logger.warn(
        `Password change failed — incorrect old password: ${id}`,
      );
      throw new BadRequestException('Incorrect old password');
    }

    const newPassHash = await argon2.hash(newPass);
    await this.usersService.changePass(user.id, newPassHash);

    this.logger.log(`Password changed successfully for user: ${id}`);
  }

  //TODO: Refactor and use Strategy Pattern in send emails
  async sendPasswordResetEmail(email: string): Promise<void> {
    this.logger.log(`Password reset requested for email: ${email}`);

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`Password reset requested for unknown email: ${email}`);
      return;
    }

    const { token, hashedToken } = this.generateResetToken();

    await this.passwordResetRepository.createPasswordResetToken(
      user.id,
      hashedToken,
      addMinutes(new Date(), 15),
    );

    this.logger.debug(`Reset token created for user: ${user.id}`);

    const url = `http://${this.config.getOrThrow<string>('HOST')}/auth/reset-password/verify?token=${token}`;

    const resetPasswordDto: MailDto = {
      to: email,
      subject: 'Password Reset',
      templateName: 'reset_password',
      templateData: { username: user.username, reset_link: url },
    };

    await this.emailService.sendMail(resetPasswordDto);

    this.logger.log(`Password reset email sent to: ${email}`);
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const { token, newPassword } = dto;
    this.logger.log('Processing password reset');

    const { userId, tokenId } = await this.validateResetToken(token);

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const hashedPassword = await argon2.hash(newPassword);
    await this.usersService.changePass(userId, hashedPassword);
    await this.passwordResetRepository.markTokenUsed(tokenId);

    this.logger.log(`Password reset successfully for user: ${userId}`);

    return { success: true, message: 'Password reset successfully' };
  }

  private async validateResetToken(token: string) {
    this.logger.debug('Validating password reset token');

    const hashedToken = createHash('sha256').update(token).digest('hex');
    const tokenRecord =
      await this.passwordResetRepository.getPasswordResetToken(hashedToken);

    if (!tokenRecord) {
      this.logger.warn('Reset token validation failed — token not found');
      throw new ForbiddenException('Invalid or expired token');
    }

    if (tokenRecord.used) {
      this.logger.warn(
        `Reset token validation failed — token already used: ${tokenRecord.id}`,
      );
      throw new ForbiddenException('Token has already been used');
    }

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      this.logger.warn(
        `Reset token validation failed — token expired: ${tokenRecord.id}`,
      );
      throw new ForbiddenException('Token has expired');
    }

    this.logger.debug(`Reset token valid for user: ${tokenRecord.userId}`);
    return { userId: tokenRecord.userId, tokenId: tokenRecord.id };
  }

  async resetToken(token: string): Promise<{ token: string }> {
    await this.validateResetToken(token);
    return { token };
  }

  private generateResetToken() {
    const token = randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hashedToken };
  }

  setCookies(res: Response, tokens: Tokens) {
    res.cookie('Authentication', tokens.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('Refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
