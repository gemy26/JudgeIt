import { BadRequestException, Injectable } from '@nestjs/common';
import { ExecutionService } from 'src/execution/execution.service';
import { S3Client, ListBucketsCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JudgeWorkerService {
    constructor(
      private executionService: ExecutionService,
      private problemsService: ProblemsService,
      private submssionsService: SubmissionsService,
      private config: ConfigService,
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

        console.log("Validation finished");

        return verdicates;
    }

    async getTestCases(problemId: number): Promise<TestCase []> {
      let TestCases: TestCase[] = [];
      const problem = await this.problemsService.getProblemById(problemId);
      const problem_slug = problem?.slug;
      console.log("Slug:", problem_slug);
      const client = new S3Client({
        region: this.config.get("S3_REGION")!,
        credentials: {
          accessKeyId: this.config.get("S3_ACCESS_KEY_ID")!,
          secretAccessKey: this.config.get("S3_SECRET_ACCESS_KEY")!
        }
      });

      console.log("Created the client");
      const params = new ListObjectsV2Command({
        Bucket: this.config.get("S3_TEST_CASES_BUCKET")!,
        Prefix: problem_slug
      });

      try {
        const response = await client.send(params);
        console.log("Folder retrieved successfully.");
        const testsCount = response.KeyCount ? ( response.KeyCount - 1 ) / 2: 0;  // divided by 2 because each test has in and out file
        console.log("Found the following test count:", testsCount);
        for(let i = 1; i <= testsCount; i++) {
          const commandIn = new GetObjectCommand({
            Bucket: this.config.get("S3_TEST_CASES_BUCKET")!,
            Key: `${problem_slug}/${i}.in`
          });
          const commandOut = new GetObjectCommand({
            Bucket: this.config.get("S3_TEST_CASES_BUCKET")!,
            Key: `${problem_slug}/${i}.out`
          });

          const fileIn = await client.send(commandIn);
          const fileOut = await client.send(commandOut);
          console.log("fetched data of input and output ");
          if (!fileIn.Body || !fileOut.Body) {
            throw new BadRequestException(`Missing file body for test case ${i}`);
          }
          const contentIn = await fileIn.Body.transformToString();
          const contentOut = await fileOut.Body.transformToString();

          console.log("contentIn", contentIn);
          console.log("contentOut", contentOut);

          const testCase: TestCase = {
            input: contentIn,
            output: contentOut,
            name: `TestCase${i}`,
          }

          TestCases.push(testCase);
        }
      } catch (err) {
        throw new BadRequestException(err);
      }
      // TODO: CACHE THOSE TEST CASES
      console.log("Test Cases :=> ", TestCases);
      return TestCases;
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

            console.log(expectedResult, actualResult);
            console.log(actualResult === expectedResult);
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
