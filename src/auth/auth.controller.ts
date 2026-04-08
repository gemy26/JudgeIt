import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Tokens } from '../types';
import { GetCurrentUser, GetCurrentUserId, Public } from '../common/decorators';
import { RtGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { AuthGuard } from '@nestjs/passport';
import { ResetPasswordDto, AuthDto, ChangePasswordDto } from '../dto';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { ApiBody } from '@nestjs/swagger';

// @UseGuards(AtGuard, RolesGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('/register')
  @ApiBody({ type: AuthDto })
  async register(@Body() dto: AuthDto, @Res() res: Response): Promise<void> {
    const tokens: Tokens = await this.authService.register(dto);
    this.authService.setCookies(res, tokens);
    res.json(tokens);
  }

  @Public()
  @Post('/login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: AuthDto })
  async login(@Body() dto: AuthDto, @Res() res: Response): Promise<void> {
    const tokens: Tokens = await this.authService.login(dto);
    this.authService.setCookies(res, tokens);
    res.json(tokens);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/logout')
  async logout(@GetCurrentUserId(new ParseIntPipe()) userId: number) {
    return this.authService.logout(userId);
  }

  @Public()
  @UseGuards(RtGuard)
  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @GetCurrentUser('sub', new ParseIntPipe()) sub: number,
    @GetCurrentUser('refreshToken') refreshToken: string,
    @Res() res: Response,
  ): Promise<void> {
    const tokens: Tokens = await this.authService.refreshTokens(
      sub,
      refreshToken,
    );
    this.authService.setCookies(res, tokens);
    res.json(tokens);
  }

  @Roles(Role.ADMIN)
  @Get('/admin')
  Admin() {
    return 'Hello, Admin';
  }

  @Public()
  @Get('/google/login')
  @UseGuards(AuthGuard('google'))
  async googleLogin(@Req() req: Request) {}

  @Public()
  @Get('/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @GetCurrentUserId(new ParseIntPipe()) userId: number,
    @GetCurrentUser('email') email: string,
    @GetCurrentUser('roles') roles: Role[],
    @Res() res: Response,
  ): Promise<void> {
    const tokens: Tokens = await this.authService.getTokens(
      userId,
      email,
      roles,
    );
    await this.authService.updateRtHash(userId, tokens.refresh_token);
    this.authService.setCookies(res, tokens);
    res.json(tokens);
  }

  @Public()
  @Get('/reset-password/verify')
  async validateResetToken(@Query('token') token: string) {
    return await this.authService.resetToken(token);
  }

  @Public()
  @Patch('/reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Public()
  @Post('/forgot-password')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@judgeit.tech' },
      },
      required: ['email'],
    },
  })
  async forgotPassword(@Body() body) {
    const email: string = body?.email;
    if (!email) {
      throw new BadRequestException('no email provided');
    }
    return this.authService.sendPasswordResetEmail(email);
  }

  @Patch('/password')
  async changePassword(
    @GetCurrentUserId(new ParseIntPipe()) id: number,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(id, body);
  }
}
