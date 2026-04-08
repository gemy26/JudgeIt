import { Injectable, Logger } from '@nestjs/common';
import { SubmissionsRepository } from './submissions.repository';
import { SubmissionListResponse, SubmissionResult } from '../types';
import { SubmissionDto } from '../dto';
import { SubmissionsResultsRepository } from './submissions-results.repository';

@Injectable()
export class SubmissionsService {
  private logger = new Logger(SubmissionsService.name, { timestamp: true });
  constructor(
    private submissionsRepo: SubmissionsRepository,
    private submissionsResultsRepo: SubmissionsResultsRepository,
  ) {}

  async addSubmission(submissionDto: SubmissionDto, userId: number) {
    this.logger.log(`Adding submission for user ${userId}`);

    return this.submissionsRepo.addSubmission(submissionDto, userId);
  }

  async updateSubmission(
    submissionId: number,
    verdict: string,
    executionTime: number,
    memoryUsed: number,
  ) {
    this.logger.log(
      `Updating submission ${submissionId} with verdict ${verdict} time=${executionTime} memory=${memoryUsed}`,
    );

    return this.submissionsRepo.updateSubmission(
      submissionId,
      verdict,
      executionTime,
      memoryUsed,
    );
  }

  async getAllSubmissions(
    userId: number,
    verdict?: string,
    limit?: number,
    offset?: number,
  ): Promise<SubmissionListResponse> {
    this.logger.debug(
      `Get submissions: user=${userId}, verdict=${verdict}, limit=${limit}, offset=${offset}`,
    );

    return this.submissionsRepo.getAllSubmissions(
      userId,
      verdict,
      limit,
      offset,
    );
  }

  async getSubmissionDetails(submissionId: number) {
    this.logger.log(`Getting submission details for ID ${submissionId}`);

    return this.submissionsRepo.getSubmissionDetails(submissionId);
  }

  async getSolvedProblems(userId: number) {
    this.logger.log(`Fetching solved problems for user ${userId}`);

    return this.submissionsRepo.getSolvedProblems(userId);
  }

  async getSubmissionsCount(userId: number) {
    this.logger.log(`Counting submissions for user ${userId}`);

    return this.submissionsRepo.getSubmissionsCount(userId);
  }

  async getsolvedProblemsCount(userId: number) {
    this.logger.log(`Counting solved problems for user ${userId}`);

    return this.submissionsRepo.getsolvedProblemsCount(userId);
  }

  async addSubmissionResults(submissionResults: SubmissionResult[]) {
    this.logger.log(
      `Adding submission results (count=${submissionResults.length})`,
    );

    return this.submissionsResultsRepo.addSubmissionResults(submissionResults);
  }
}
