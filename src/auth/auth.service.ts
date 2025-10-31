import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GoogleProfileDto, AuthDto, MailDto, ResetPasswordDto, ChangePasswordDto } from '../dto';
import { UsersService } from 'src/users/users.service';
import * as argon2 from 'argon2'
import { Tokens } from '../types';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PasswordResetRepository } from './password-reset.repository';
import { addMinutes } from 'date-fns';
import { EmailService } from '../email/email.service';
import * as crypto from 'crypto';


@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private passwordResetRepository: PasswordResetRepository,
    private emailService: EmailService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) { }

  async updateRtHash(userId: number, rt: string) {
    console.log('Updating hash for token:', rt);
    const hashedRt = await argon2.hash(rt);
    console.log('New hash:', hashedRt);
    await this.usersService.updateRtHash(userId, hashedRt);
  }

  async getTokens(userId: number, email: string, roles: Role[]): Promise<Tokens> {
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          roles: roles
        },
        {
          secret: this.config.get('ACCESS_TOKEN_SECRET'),
          expiresIn: this.config.get('ACCESS_TOKEN_EXPIRATION')
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          roles: roles
        },
        {
          secret: this.config.get('REFRESH_TOKEN_SECRET'),
          expiresIn: this.config.get('REFRESH_TOKEN_EXPIRATION')
        },
      ),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  async signupLocal(dto: AuthDto): Promise<Tokens> {
    const hashedPassword = await argon2.hash(dto.password);

    const newUserDto = { ...dto, password: hashedPassword };
    const user = await this.usersService.createUser(newUserDto);

    // Generate the jwt access token and refresh token and save in cookies (or passport handle that) and return an new object with all that data
    // may use interceptor to set jwt data and delete the password from response and use the current response but its not good at all

    console.log("SignUp  user => ", user)
    const tokens: Tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRtHash(user.id, tokens.refresh_token);
    return tokens
  }

  async signinLocal(dto: AuthDto): Promise<Tokens> {
    let { email, password } = dto;
    const user = await this.usersService.findUser(dto);
    if (!user.hash) {
      throw new ForbiddenException(
        'This account uses OAuth login. Please sign in with Google.',
      );
    }

    const IsValidPassword = await argon2.verify(user.hash, password);
    if (!IsValidPassword) {
      throw new ConflictException("Not valid credintial");
    }

    console.log("SignIn => ", user);

    const tokens: Tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRtHash(user.id, tokens.refresh_token);
    return tokens
  }

  async logout(userId: number) {
    await this.usersService.deleteRt(userId);
  }

  async refreshTokens(userId: string, rt: string): Promise<Tokens> {
    console.log("Auth Service => ")

    const user = await this.usersService.findById(userId);
    if (!user || !user.hashedRt) {
      throw new ForbiddenException('Access denied');
    }

    console.log("userRtHashed => ", user.hashedRt);
    console.log("Rt => ", rt);

    const rtMatches = await argon2.verify(user.hashedRt, rt);
    if (!rtMatches) {
      console.log('not matches')
      throw new ForbiddenException('Access denied');
    }

    const tokens: Tokens = await this.getTokens(user.id, user.email, user.role);
    await this.updateRtHash(user.id, tokens.refresh_token);
    return tokens
  }

  async validateOAuthLogin(
    googleProfile: GoogleProfileDto,
    accessToken: string,
    refreshToken: string,
    provider: string
  ) {

    if (!googleProfile.email) {
      throw new UnauthorizedException('Email not provided by OAuth provider');
    }

    if (!googleProfile.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email with the OAuth provider first',
      );
    }

    const account = await this.usersService.findAccountByProvider(
      provider,
      googleProfile.id
    );

    if (account) {
      await this.usersService.updateOauthAccount(
        account,
        accessToken,
        refreshToken,
      );
      return account.user;
    }

    const user = await this.usersService.findByEmail(googleProfile.email);
    if (user) {
      await this.usersService.linkOauthUser(
        user,
        provider,
        googleProfile,
        accessToken,
        refreshToken,
      );
      return user;
    }

    return this.usersService.createOauthUser(
      provider,
      googleProfile,
      accessToken,
      refreshToken,
    );
  }


  async changePassword(id: string, dto: ChangePasswordDto) {
    const { oldPass, newPass } = dto;

    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const email = user.email;
    const hasAccount = await this.usersService.hasAccount(email);

    if (hasAccount) {
      throw new BadRequestException("User is registered with google");
    }

    if(!user.hash){
      throw new BadRequestException('User has no password hash');
    }

    const isValidPass = await argon2.verify(user.hash, oldPass);
    if (!isValidPass) {
      throw new BadRequestException("Incorrect old password");
    }

    const newPassHash = await argon2.hash(newPass);
    return await this.usersService.changePass(user.id, newPassHash);
  }

  async sendPasswordResetEmail(email: string) { //forget password
    const user = await this.usersService.findByEmail(email);
    if(!user) {
      throw new NotFoundException("User not found");
    }

    console.log(user);

    const {token, hashedToken} = await this.generateResetToken();

    try{
      console.log('Creating reset token for userId:', typeof user.id);
      await this.passwordResetRepository.createPasswordResetToken(user.id, hashedToken, addMinutes(new Date(), 15));
    }catch(err){
      // throw new BadRequestException(err.message);
      console.error('ERROR STACK:', err.stack);
    }

    const url = `http://localhost:3000/auth/reset-password/?token=${token}`;

    const resetPasswordDto: MailDto = {
      to: email,
      subject: "Password Reset",
      templateName: "reset_password",
      templateData: {username: user.username, reset_link: url}
    };

    await this.emailService.sendMail(resetPasswordDto);

    console.log("Reset email sent");
  }

  async reserPassword(dto: ResetPasswordDto) {

    const {token, newPassword} = dto;
    const { userId, tokenId } = await this.validateResetToken(token);

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const hashedPassword = await argon2.hash(newPassword);

    await this.usersService.changePass(userId, hashedPassword);

    await this.passwordResetRepository.markTokenUsed(tokenId);

    console.log("Reset email success");

    return {
      success: true,
      message: 'Password reset successfully'
    };
  }

  async validateResetToken(token: string){
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const tokenRecord = await this.passwordResetRepository.getPasswordResetToken(hashedToken);
    if (!tokenRecord) {
      throw new ForbiddenException("Invalid or expired token");
    }

    if (tokenRecord.used) {
      throw new ForbiddenException("Token has already been used");
    }

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException("Token has expired");
    }

    return {
      userId: tokenRecord.userId,
      tokenId: tokenRecord.id
    };

  }

  async generateResetToken() {
    const token = randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    return { token, hashedToken };
  }

}
