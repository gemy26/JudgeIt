import { Injectable } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { EventPattern, Payload } from '@nestjs/microservices';

@Injectable()
export class KafkaConsumerService {
  constructor(private kafkaService: KafkaService) {}

  @EventPattern("test-topic")
  async handleEvent(@Payload() message: any) {
    console.log(`Received ${JSON.stringify(message)}`);
  }
}
