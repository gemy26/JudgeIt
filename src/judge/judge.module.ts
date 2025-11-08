import { forwardRef, Module } from '@nestjs/common';
import { JudgeWorkerService } from './judge-worker/judge-worker.service';
import { ExecutionModule } from 'src/execution/execution.module';
import { ProblemsModule } from '../problems/problems.module';
import { ProblemsService } from '../problems/problems.service';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [ExecutionModule, ProblemsModule, forwardRef(() => SubmissionsModule)],
  providers: [JudgeWorkerService, ProblemsService],
  exports: [JudgeWorkerService],
})
export class JudgeModule {}
