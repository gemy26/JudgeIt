import { forwardRef, Module } from '@nestjs/common';
import { WorkerManagerService } from '../worker/worker-manager.service';
import { ExecutionModule } from 'src/execution/execution.module';
import { ProblemsModule } from '../problems/problems.module';
import { ProblemsService } from '../problems/problems.service';
import { SubmissionsModule } from '../submissions/submissions.module';
import { TestCasesService } from './test-cases/test-cases.service';

@Module({
  imports: [
    ExecutionModule,
    ProblemsModule,
    forwardRef(() => SubmissionsModule),
  ],
  providers: [WorkerManagerService, ProblemsService, TestCasesService],
  exports: [WorkerManagerService],
})
export class JudgeModule {}
