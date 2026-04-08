import { forwardRef, Module } from '@nestjs/common';
import { ExecutionModule } from 'src/execution/execution.module';
import { ProblemsModule } from '../problems/problems.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { JudgeService } from './judge.service';
import { TestCasesService } from './test-cases/test-cases.service';
import { StorageModule } from '../storage/storage.module';
import { CachingModule } from '../cache/cachingModule';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    ExecutionModule,
    ProblemsModule,
    StorageModule,
    CachingModule,
    forwardRef(() => SubmissionsModule),
    MonitoringModule,
  ],
  providers: [JudgeService, TestCasesService],
  exports: [JudgeService],
})
export class JudgeModule { }
