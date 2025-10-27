import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { GoogleProfileDto, AuthDto } from '../dto';
import { UsersService } from 'src/users/users.service';
import * as argon2 from 'argon2'
import { Tokens } from '../types';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService,
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

}
