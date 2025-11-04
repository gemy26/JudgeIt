import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { Connection } from 'nodemailer/lib/mailer';
import Redis from 'ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BoxManager } from './box.manager';

@Module({
  imports: [ConfigModule],
  providers: [
    ExecutionService,
    {
      provide: "REDIS_CLIENT",
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<number>('REDIS_PORT');
        const client = new Redis({
          host: host,
          port: port
        });
        client.on('connect', () => console.log('Redis connected'));
        client.on('error', (err) => console.error('Redis error:', err));

        return client;
      },
      inject: [ConfigService],
    },
    BoxManager
  ],
  exports: [ExecutionService, BoxManager]

})
export class ExecutionModule {}
