import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from 'src/users/users.service';
import { UsersModule } from 'src/users/users.module';
import { AtStrategy, RtStrategy, googleStrategy } from './strategies';
import { JwtModule } from '@nestjs/jwt';
@Module({
  imports: [UsersModule, JwtModule.register({})],
  providers: [AuthService, UsersService, AtStrategy, RtStrategy, googleStrategy],
  controllers: [AuthController]
})

export class AuthModule {}
