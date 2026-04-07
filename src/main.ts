import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      level: 'silly',
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize({ all: true }),
            winston.format.printf(({ timestamp, level, message, context }) => {
              return `${timestamp} [${context || 'App'}] ${level}: ${message}`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'silly',
        }),
      ],
    }),
  });

  const config = new DocumentBuilder()
    .setTitle('JudgeIt.tech API')
    .setDescription('The Judgeit.tech API description')
    .setVersion('1.0')
    .addCookieAuth('Authorization')
    .addCookieAuth('Refresh')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, documentFactory, {
    swaggerOptions: {
      withCredentials: true,
    },
  });

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://judgeit.tech',
      'https://www.judgeit.tech',
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
