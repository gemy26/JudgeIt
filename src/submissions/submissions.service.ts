import { Injectable } from '@nestjs/common';
import { SubmissionsRepository } from './submissions.repository';
import { SolvedProblemResult, SubmissionResponse } from '../types';
import { SubmissionDto } from '../dto';

@Injectable()
export class SubmissionsService {
  constructor(private submissionsRepo: SubmissionsRepository) {}

  async addSubmission(submissionDto: SubmissionDto, userId: number){
    return this.submissionsRepo.addSubmission(submissionDto, userId);
  }

  async updateSubmission(submissionId: number, verdicate: string){
    return this.submissionsRepo.updateSubmission(submissionId, verdicate);
  }

  async getAllSubmissions(userId : number, verdicate?: string): Promise<SubmissionResponse[]>  {
    return this.submissionsRepo.getAllSubmissions(userId , verdicate);
  }

  async getSubmissionDetails(submissionId : number): Promise<SubmissionResponse | null> {
    return this.submissionsRepo.getSubmissionDetails(submissionId);
  }

  async getSolvedProblems(userId : number): Promise<SolvedProblemResult[]> {
    return this.submissionsRepo.getSolvedProblems(userId);
  }


  async getSubmissionsCount(userId: number){
    return this.submissionsRepo.getSubmissionsCount(userId);
  }

  async getsolvedProblemsCount(userId: number){
    return this.submissionsRepo.getsolvedProblemsCount(userId);
  }

  // TODO: Add submission
  // TODO: update submission (update verdicate | status)
}
