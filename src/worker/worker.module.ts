import { Module } from '@nestjs/common';
import { WorkerManagerService } from './worker-manager.service';
import { KafkaModule } from '../kafka/kafka.module';
import { JudgeModule } from '../judge/judge.module';

@Module({
  imports: [KafkaModule, JudgeModule],
  providers: [WorkerManagerService],
})
export class WorkerModule { }
