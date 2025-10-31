import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ProblemsModule } from './problems/problems.module';
import { EmailModule } from './email/email.module';
import { APP_GUARD } from '@nestjs/core';
import { AtGuard, RolesGuard } from './common/guards';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UsersModule,
    SubmissionsModule,
    ProblemsModule,
    EmailModule,
    
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,   // Now its Globally all endpoints apply that Guard (AtGuard)
      useClass: AtGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    }
  ]
})
export class AppModule {}
