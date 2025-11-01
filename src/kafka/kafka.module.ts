import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaConsumerService } from './kafkaConsumerService';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => {
          const brokers = configService
            .get<string>('KAFKA_BROKERS')!
            ?.split(',') // convert "localhost:9092,localhost:9093" → ["localhost:9092", "localhost:9093"]
            .map(b => b.trim());

          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: configService.get<string>('KAFKA_CLIENT_ID')!,
                brokers: brokers,
              },
              consumer: {
                groupId:
                  configService.get<string>('KAFKA_GROUP_ID')!,
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaService, KafkaConsumerService],
  exports: [KafkaService, KafkaConsumerService],
  controllers: [],
})
export class KafkaModule {}
