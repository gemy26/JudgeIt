import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {

    constructor(@Inject('KAFKA_SERVICE') private kafkaClient: ClientKafka) {}

    async onModuleInit() {
      // this.kafkaClient.subscribeToResponseOf('test-topic');
      await this.kafkaClient.connect();
      console.log('Kafka connected and consumer ready.');

      setTimeout(() => {
        const dummySubmission = {
          code: `#include <iostream>
               using namespace std;
               int main() {
                 int a; 
                 cin >> a;
                 cout << a + 1 << endl;
                 return 0;
               }`,
        };
        this.sendMessage({ msg: dummySubmission });
      }, 5000);

    }

    async onModuleDestroy() {
        await this.kafkaClient.close();
    }

    // async sendMessage(topic: string, message: any) {
    //     return this.kafkaClient.emit(topic, message);
    // }

  async sendMessage(message: any) {
    console.log(`Producing message: ${JSON.stringify(message)}`);
    await this.kafkaClient.emit('test-topic', message);
  }

}
