import { Module } from '@nestjs/common';
import { WorkerManagerService } from './worker-manager.service';
import { KafkaModule } from '../kafka/kafka.module';
import { JudgeModule } from '../judge/judge.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [KafkaModule, JudgeModule, MonitoringModule],
  providers: [WorkerManagerService],
})
export class WorkerModule { }
