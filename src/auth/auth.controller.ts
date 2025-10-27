import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto } from '../dto/auth.dto';
import { Tokens } from '../types';
import { GetCurrentUser, GetCurrentUserId, Public, SKIP_KEY, SkipAuth } from '../common/decorators';
import { AtGuard, RtGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('/local/signup')
  signupLocal(@Body() dto: AuthDto): Promise<Tokens> {
    return this.authService.signupLocal(dto);
  }

  @Public()
  @Post('/local/signin')
  @HttpCode(HttpStatus.OK)
  signinLocal(@Body() dto: AuthDto) {
    return this.authService.signinLocal(dto);
  }

  @UseGuards(AtGuard)
  @HttpCode(HttpStatus.OK)
  @Post('/local/logout')
  logout(@GetCurrentUserId() userId: string) {
    console.log('Here')
    return this.authService.logout(parseInt(userId));
  }



  @Public()
  @UseGuards(RtGuard)
  @Post('/local/refresh')
  @HttpCode(HttpStatus.OK)
  refreshTokens(@GetCurrentUser('sub') sub: string, @GetCurrentUser('refreshToken') refreshToken: string) {
    console.log("Refresh uri, userId => ", sub)
    console.log("Refresh uri, refreshToken => ", refreshToken)
    return this.authService.refreshTokens(sub, refreshToken);
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
    @GetCurrentUser('role') role: []
  ): Promise<Tokens> {
    const userId = parseInt(id);
    const tokens: Tokens = await this.authService.getTokens(
      userId,
      email,
      role || [],
    );

    console.log('callback url, ID: ', id);
    console.log('callback url, Email: ', email);
    await this.authService.updateRtHash(userId, tokens.refresh_token);

    return tokens;
  }

}
