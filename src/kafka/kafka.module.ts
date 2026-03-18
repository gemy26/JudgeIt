import { forwardRef, Module } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExecutionModule } from '../execution/execution.module';
import { JudgeModule } from '../judge/judge.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { Kafka } from 'kafkajs';

export const KAFKA_CLIENT = 'KAFKA_CLIENT';

@Module({
  imports: [
    ExecutionModule,
    forwardRef(() => JudgeModule),
    forwardRef(() => SubmissionsModule),
    ConfigModule,
  ],
  providers: [
    KafkaProducerService,
    {
      provide: KAFKA_CLIENT,
      useFactory: (config: ConfigService): Kafka => {
        return new Kafka({
          clientId: config.get<string>('KAFKA_CLIENT_ID', 'judge-app'),
          brokers: config
            .get<string>('KAFKA_BROKERS', 'localhost:9092')
            .split(','),
          connectionTimeout: 3000,
          requestTimeout: 30000,
          retry: {
            retries: 3,
            initialRetryTime: 300,
            factor: 2,
          },
        });
      },
    },
  ],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
