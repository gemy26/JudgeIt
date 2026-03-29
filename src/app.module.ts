import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ProblemsModule } from './problems/problems.module';
import { EmailModule } from './email/email.module';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AtGuard, RolesGuard } from './common/guards';
import { KafkaModule } from './kafka/kafka.module';
import { ExecutionModule } from './execution/execution.module';
import { JudgeModule } from './judge/judge.module';
import { WorkerModule } from './worker/worker.module';
import cookieParser from 'cookie-parser';

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
    }),
    AuthModule,
    UsersModule,
    SubmissionsModule,
    ProblemsModule,
    EmailModule,
    KafkaModule,
    ExecutionModule,
    JudgeModule,
    WorkerModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD, // Now its Globally all endpoints apply that Guard (AtGuard)
      useClass: AtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}
