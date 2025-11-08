import { Injectable } from '@nestjs/common';
import { SubmissionsRepository } from './submissions.repository';
import {
  SolvedProblemResult,
  SubmissionResponse,
  SubmissionResult,
} from '../types';
import { SubmissionDto } from '../dto';
import { SubmissionsResultsRepository } from './submissions-results.repository';

@Injectable()
export class SubmissionsService {
  constructor(private submissionsRepo: SubmissionsRepository, private submissionsResultsRepo: SubmissionsResultsRepository) {}

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

  async addSubmissionResults(submissionResults: SubmissionResult[]){
    return this.submissionsResultsRepo.addSubmissionResults(submissionResults);
  }
}
