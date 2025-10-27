import { Injectable } from '@nestjs/common';
import { SubmissionsRepository } from './submissions.repository';
import { SubmissionResponse } from '../types';

@Injectable()
export class SubmissionsService {
  constructor(private submissionsRepo: SubmissionsRepository) {}
  async getAllSubmissions(userId : number, verdicate?: string): Promise<SubmissionResponse[]>  {
    return this.submissionsRepo.getAllSubmissions(userId , verdicate);
  }

  async getSubmissionDetails(submissionId : number): Promise<SubmissionResponse | null> {
    return this.submissionsRepo.getSubmissionDetails(submissionId);
  }

  // TODO: Add submission
  // TODO: update submission (update verdicate | status)
}
