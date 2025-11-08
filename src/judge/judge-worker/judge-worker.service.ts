import { Injectable } from '@nestjs/common';
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

@Injectable()
export class JudgeWorkerService {
    constructor(
      private executionService: ExecutionService,
      private problemsService: ProblemsService,
      private submssionsService: SubmissionsService
    ) { }
    async judgeSubmission(submissionDetails: SubmissionQueuedEvent): Promise<string []> {
        console.log("JudgeWorker");
        const tests = await this.getTestCases(submissionDetails.problemId);
        const problemDetails: ProblemDetails = await this.getProblemDetails(submissionDetails.problemId);
        const config: Partial<ExecutionConfig> = {
            timeLimit: problemDetails.TimeLimit,        // 2 seconds
            memoryLimit: problemDetails.MemoryLimit * 1000, // 256 MB in KB
            stackLimit: problemDetails.MemoryLimit * 1000,
            processes: 1,
            wallTimeMultiplier: 2
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
        if(verdicates?.length !== tests.length) {
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

        return verdicates;
    }

    async getTestCases(problemId: number): Promise<TestCase []> { //Just dummy tests for now
        // TODO: fetch from DB/ storage
        return [
            {
                input: '5',
                output: '6',
                name: 'Test Case 1'
            },
            {
                input: '10',
                output: '11',
                name: 'Test Case 2'
            },
        ]
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
