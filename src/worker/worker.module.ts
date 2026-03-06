import { Module } from '@nestjs/common';
import { WorkerManagerService } from './worker-manager.service';
import { SemaphoreService } from './semaphore.service';
import { OffsetTrackerService } from './offset-Tracker.service';
import { KafkaModule } from '../kafka/kafka.module';
import { JudgeModule } from '../judge/judge.module';
import { JudgeService } from '../judge/judge.service';

@Module({
  imports: [KafkaModule, JudgeModule],
  providers: [WorkerManagerService, SemaphoreService, OffsetTrackerService, JudgeService],
})
export class WorkerModule {}
