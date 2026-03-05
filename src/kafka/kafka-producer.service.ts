import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';
import { SubmissionDto } from 'src/dto';
import { SubmissionQueuedEvent } from 'src/types';
import { timestamp } from 'rxjs';
import { CompressionTypes, Producer } from 'kafkajs';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private logger: Logger;
  private producer: Producer;
  constructor(@Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka) {
    this.logger = new Logger('KafkaProducerService', { timestamp: true });
    this.producer = this.kafkaClient.producer
  }

  async onModuleInit() {
    await this.kafkaClient.connect();
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

    this.logger.log(`KafkaProducer send message of submission ${message.submissionId}`, message);
  }
}
