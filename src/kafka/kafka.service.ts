import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';
import { SubmissionDto } from 'src/dto';
import { SubmissionQueuedEvent } from 'src/types';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {

    constructor(@Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka) {}

    async onModuleInit() {
      await this.kafkaClient.connect();
      console.log('Kafka connected and consumer ready.');
    }

    async onModuleDestroy() {
        await this.kafkaClient.close();
    }

  async sendMessage(message: SubmissionQueuedEvent) {
    console.log(`Producing message: ${JSON.stringify(message)}`);
    await this.kafkaClient.emit('ExecuteSubmission', message);
  }

}
