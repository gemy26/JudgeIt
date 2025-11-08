import { forwardRef, Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaConsumerService } from './kafkaConsumerService';
import { ExecutionModule } from '../execution/execution.module';
import { JudgeModule } from '../judge/judge.module';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [
    ExecutionModule,
    forwardRef(() => JudgeModule),
    forwardRef(() => SubmissionsModule),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => {
          const brokers = configService
            .get<string>('KAFKA_BROKERS')!
            ?.split(',')
            .map(b => b.trim());

          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: configService.get<string>('KAFKA_CLIENT_ID')!,
                brokers: brokers,
              },
              consumer: {
                groupId: `${configService.get<string>('KAFKA_GROUP_ID')!}-producer`,
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaService],
  exports: [KafkaService],
  controllers: [KafkaConsumerService],
})
export class KafkaModule {}