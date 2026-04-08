import { Injectable, Logger } from '@nestjs/common';
import { ExecutionService } from 'src/execution/execution.service';
import {
  ExecutionConfig,
  ExecutionResult,
  ProblemDetails,
  SubmissionQueuedEvent,
  SubmissionResult,
  TestCase,
} from 'src/types';
import { ProblemsService } from '../problems/problems.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { TestCasesService } from './test-cases/test-cases.service';

@Injectable()
export class JudgeService {
  private readonly logger = new Logger(JudgeService.name, { timestamp: true });

  constructor(
    private executionService: ExecutionService,
    private problemsService: ProblemsService,
    private submssionsService: SubmissionsService,
    private testCaseService: TestCasesService,
  ) {}

  async judgeSubmission(
    submissionDetails: SubmissionQueuedEvent,
    boxId: number,
  ): Promise<string[]> {
    const { submissionId, problemId } = submissionDetails;
    this.logger.log(
      `START submissionId=${submissionId} problemId=${problemId} boxId=${boxId}`,
    );

    const [testCases, problemDetails] = await Promise.all([
      this.testCaseService.getTestCases(problemId),
      this.getProblemDetails(problemId),
    ]);

    this.logger.debug(
      `Loaded ${testCases.length} test cases | timeLimit=${problemDetails.TimeLimit} memoryLimit=${problemDetails.MemoryLimit}MB`,
    );

    const config: Partial<ExecutionConfig> = {
      timeLimit: problemDetails.TimeLimit,
      memoryLimit: problemDetails.MemoryLimit * 1000,
      stackLimit: problemDetails.MemoryLimit * 1000,
      processes: 1,
    };

    this.logger.debug(
      `Executing batch for submissionId=${submissionId} language=${submissionDetails.language}  testCases=${testCases}`,
    );
    const results = await this.executionService.executeBatch(
      boxId,
      submissionDetails.code,
      submissionDetails.language,
      testCases,
      config,
    );
    this.logger.debug(
      `Batch execution complete submissionId=${submissionId} results=${results.length}`,
    );

    const verdicates = this.validateResults(results, testCases);
    this.logger.debug(
      `Verdicates submissionId=${submissionId} verdicates=[${verdicates.join(', ')}]`,
    );

    let exectionTime = 0,
      memoryUsed = 0;
    let finalVerdicate = 'ACC';
    for (const verdicate of verdicates) {
      if (verdicate !== 'ACC') {
        finalVerdicate = verdicate;
        break;
      }
    }

    this.logger.log(
      `FINAL submissionId=${submissionId} verdict=${finalVerdicate}`,
    );

    const submissionResults: SubmissionResult[] = [];
    for (let i = 0; i < verdicates.length; i++) {
      const execution_time_ms = Math.round((results[i].time ?? 0) * 1000);
      const memory_kb = results[i].memory ?? 0;
      const memory_mb = +(memory_kb / 1024).toFixed(2);

      submissionResults.push({
        submissionId,
        verdict: verdicates[i],
        executionTime: results[i].time!,
        memoryUsed: results[i].memory!,
        testcaseName: testCases[i].name,
        createdAt: new Date(),
      });
      exectionTime = Math.max(exectionTime, execution_time_ms);
      memoryUsed = Math.max(memoryUsed, memory_mb);
    }
    await this.submssionsService.updateSubmission(
      submissionId,
      finalVerdicate,
      exectionTime,
      memoryUsed,
    );
    this.logger.debug(`Updated submission record submissionId=${submissionId}`);
    await this.submssionsService.addSubmissionResults(submissionResults);
    this.logger.debug(
      `Stored ${submissionResults.length} result records for submissionId=${submissionId}`,
    );

    return verdicates;
  }

  async getProblemDetails(problemId: number): Promise<ProblemDetails> {
    return await this.problemsService.getProblemDetails(problemId);
  }

  private validateResults(
    results: ExecutionResult[],
    tests: TestCase[],
  ): string[] {
    const verdicates: string[] = [];

    for (let i = 0; i < results.length; i++) {
      if (results[i].status !== 'OK') {
        this.logger.warn(
          `Test ${i + 1}/${tests.length} failed with status=${results[i].status} testcase=${tests[i].name}`,
        );
        verdicates.push(results[i].status);
        break;
      }

      const expected = this.normalizeOutputStrict(tests[i].output!);
      const actual = this.normalizeOutputStrict(results[i].output!);
      const verdict = expected === actual ? 'ACC' : 'WA';

      this.logger.debug(
        `Test ${i + 1}/${tests.length} testcase=${tests[i].name} verdict=${verdict}`,
      );
      verdicates.push(verdict);
    }

    return verdicates;
  }

  private normalizeOutputStrict(output: string): string {
    if (!output) return '';

    return output
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .join(' ');
  }
}
