import { Injectable } from '@nestjs/common';
import { ProblemsRepository } from './problems.repository';
import { ProblemFilterDto } from 'src/dto';
import { ProblemDetails } from '../types';

@Injectable()
export class ProblemsService {
  constructor(private problemsRepo: ProblemsRepository) { }

  async getAllProblems(filter: ProblemFilterDto) {
    return this.problemsRepo.findProblems(filter);
  }

  async getProblemById(id: number) {
    return this.problemsRepo.getProblemById(id);
  }

  async getProblemBySlug(slug: string) {
    return this.problemsRepo.getProblemBySlug(slug);
  }

  async getProblemDetails(problemId: number): Promise<ProblemDetails> {
    return this.problemsRepo.getProblemDetails(problemId);
  }

}
