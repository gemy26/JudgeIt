import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Tokens } from '../types';
import { GetCurrentUser, GetCurrentUserId, Public, SkipAuth } from '../common/decorators';
import { AtGuard, RtGuard, RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { AuthGuard } from '@nestjs/passport';
import { ResetPasswordDto, AuthDto, ChangePasswordDto } from '../dto';
import type { Response } from 'express';

// @UseGuards(AtGuard, RolesGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('/local/signup')
  async signupLocal(@Body() dto: AuthDto, @Res() res: Response): Promise<void> {
    const tokens: Tokens = await this.authService.signupLocal(dto);

     res.cookie('Authentication', tokens.access_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('Refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    res.json(tokens);
  }

  @Public()
  @Post('/local/signin')
  @HttpCode(HttpStatus.OK)
  async signinLocal(@Body() dto: AuthDto, @Res() res: Response): Promise<void> {
    const tokens: Tokens = await this.authService.signinLocal(dto);

    res.cookie('Authentication', tokens.access_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('Refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    res.json(tokens);
  }

  // @UseGuards(AtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/local/logout')
  async logout(@GetCurrentUserId() userId: string) {
    console.log('Here')
    return this.authService.logout(parseInt(userId));
  }



  @Public()
  @UseGuards(RtGuard)
  @Post('/local/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @GetCurrentUser('sub') sub: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
    @Res() res: Response
  ): Promise<void> {
    console.log("Refresh uri, userId => ", sub)
    console.log("Refresh uri, refreshToken => ", refreshToken)
    const tokens: Tokens = await this.authService.refreshTokens(sub, refreshToken);
    
    res.cookie('Authentication', tokens.access_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('Refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    res.json(tokens);
  }

  @Roles(Role.ADMIN)
  @Get('/admin')
  Admin() {
    return "Hello, Admin"
  }

  @Public()
  @Get('/google')
  @UseGuards(AuthGuard('google'))
  async oauthLogin(@Req() req) { }

  @Public()
  @Get('/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @GetCurrentUser('id') id: string,
    @GetCurrentUser('email') email: string,
    @GetCurrentUser('role') role: [],
    @Res() res: Response
  ): Promise<void> {
    const userId = parseInt(id);
    const tokens: Tokens = await this.authService.getTokens(
      userId,
      email,
      role || [],
    );

    console.log('callback url, ID: ', id);
    console.log('callback url, Email: ', email);
    await this.authService.updateRtHash(userId, tokens.refresh_token);

    res.cookie('Authentication', tokens.access_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('Refresh', tokens.refresh_token, {
      httpOnly: true,
      secure: false, // true in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, //7 days
    });

    res.json(tokens);
  }

  @SkipAuth()
  @Public()
  @Get('/verify-reset-token')
  async verifyResetToken(@Query() token: string){
    return this.authService.validateResetToken(token);
  }

  @SkipAuth()
  @Public()
  @Get('/reset-password')
  async resetPassword(@Body() body: ResetPasswordDto){
    return this.authService.resetPassword(body);
  }

  @SkipAuth()
  @Public()
  @Get('/forget-password')
  async forgetPassword(@Body() body){
    return this.authService.sendPasswordResetEmail(body?.email);
  }

  @Post('/change-password')
  async changePassword(@GetCurrentUserId() id: string, @Body() body: ChangePasswordDto){
    console.log('Controller: changePassword userId =>', id);
    return this.authService.changePassword(id, body);
  }
}
