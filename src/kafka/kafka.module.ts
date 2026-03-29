import { Module } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { KAFKA_CLIENT } from './kafka.constants';

@Module({
  imports: [ConfigModule],
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
          connectionTimeout: 30000,
          requestTimeout: 30000,
          retry: {
            retries: 10,
            initialRetryTime: 1000,
            factor: 2,
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [KafkaProducerService, KAFKA_CLIENT],
})
export class KafkaModule { }
