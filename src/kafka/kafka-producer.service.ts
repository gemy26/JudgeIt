import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { SubmissionQueuedEvent } from 'src/types';
import { CompressionTypes, Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private logger: Logger;
  private producer: Producer;
  constructor(@Inject('KAFKA_SERVICE') private kafkaClient: Kafka) {
    this.logger = new Logger('KafkaProducerService', { timestamp: true });
    this.producer = this.kafkaClient.producer({
      idempotent: true,
      maxInFlightRequests: 1,
    });
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log('Kafka connected and producer ready.');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    this.logger.log('Kafka producer disconnected');
  }

  async sendMessage(topic: string, message: SubmissionQueuedEvent) {
    await this.producer.send({
      topic,
      compression: CompressionTypes.Snappy,
      messages: [
        {
          value: JSON.stringify(message),
        },
      ],
      // All in-sync replicas must ack before resolving — strongest guarantee
      acks: -1,
      timeout: 30000,
    });

    this.logger.log(
      `KafkaProducer send message of submission ${message.submissionId}`,
      message,
    );
  }
}
