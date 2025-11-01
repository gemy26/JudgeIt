import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonLogger, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

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
            })
          )
        }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      ],
    })
  });

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
