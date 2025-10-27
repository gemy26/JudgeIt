import { Injectable } from '@nestjs/common';
import { ProblemsRepository } from './problems.repository';
import { ProblemFilterDto } from 'src/dto';

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
}
