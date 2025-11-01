import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context }) => {
              return `${timestamp} [${context || 'App'}] ${level}: ${message}`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
      ],
    }),
  });

  const configService = app.get(ConfigService);
  const brokers = configService
    .get<string>('KAFKA_BROKERS')!
    ?.split(',')
    .map(b => b.trim());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: configService.get("KAFKA_CLIENT_ID")!,
        brokers: brokers,
      },
      consumer: {
        groupId: configService.get("KAFKA_GROUP_ID")!
      }
    }
  });

  await app.startAllMicroservices();

  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     transform: true
  //   })
  // )

  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
