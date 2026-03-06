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
import { ProblemsService } from '../../problems/problems.service';
import { SubmissionsService } from '../../submissions/submissions.service';
// import { TestCaseService } from '../test-case.service';

@Injectable()
export class JudgeService {
    private readonly logger = new Logger(JudgeService.name);

    constructor(
      private executionService: ExecutionService,
      private problemsService: ProblemsService,
      private submssionsService: SubmissionsService,
      // private testCaseService: TestCaseService,
    ) { }

    async judgeSubmission(submissionDetails: SubmissionQueuedEvent): Promise<string []> {
        this.logger.debug(`Judging submission ${submissionDetails.submissionId}`);

        // Fetch problem details and test cases in parallel
        const problem = await this.problemsService.getProblemById(submissionDetails.problemId);
        const [tests, problemDetails] = await Promise.all([
          // this.testCaseService.getTestCases(submissionDetails.problemId, problem!.slug),
          this.getProblemDetails(submissionDetails.problemId),
        ]);

        const config: Partial<ExecutionConfig> = {
            timeLimit: problemDetails.TimeLimit,
            memoryLimit: problemDetails.MemoryLimit * 1000,
            stackLimit: problemDetails.MemoryLimit * 1000,
            processes: 1,
        };

        let results: ExecutionResult[] = [];

        results = await this.executionService.executeBatch(
          submissionDetails.code,
          submissionDetails.language,
          tests,
          config
        );


        const verdicates = await this.validateResults(results, tests);

        let finalVerdicate = "ACC";
        if(verdicates?.length !== tests.length || verdicates[verdicates.length - 1] !== "ACC") {
          finalVerdicate = verdicates[verdicates.length - 1];
        }

        await this.submssionsService.updateSubmission(submissionDetails.submissionId, finalVerdicate);

        let submissionResults: SubmissionResult[] = [];
        for(let i = 0; i < verdicates.length; i ++){
          const submissionResult: SubmissionResult = {
            submissionId: submissionDetails.submissionId,
            verdict: verdicates[i],
            executionTime: results[i].time!,
            memoryUsed: results[i].memory!,
            testcaseName: tests[i].name,
            createdAt: new Date()
          };
          submissionResults.push(submissionResult);
        }

        await this.submssionsService.addSubmissionResults(submissionResults);

        this.logger.debug(`Submission ${submissionDetails.submissionId} judged: ${finalVerdicate}`);

        return verdicates;
    }

    async getProblemDetails(problemId: number): Promise<ProblemDetails> {
        return await this.problemsService.getProblemDetails(problemId);
    }

    async validateResults(results: ExecutionResult[], tests: TestCase[]): Promise<string[]> {
        const verdicates: string[] = [];
        for (let i = 0; i < results.length; i ++) {
            if (results[i].status !== 'OK') {
                verdicates.push(results[i].status);
                break;
            }

            const expectedResult = this.normalizeOutputStrict(tests[i].output!);
            const actualResult = this.normalizeOutputStrict(results[i].output!);


            if(expectedResult === actualResult) {
                verdicates.push("ACC");
            } else {
                verdicates.push("WA");
            }
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
            .filter(token => token.length > 0)
            .join(' ');                       
    }
}
