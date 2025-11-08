import { Prisma } from "@prisma/client";
import { ProblemFilterDto } from '../dto/';
import { PrismaService } from "src/prisma/prisma.service";
import { Problem, ProblemDetails } from 'src/types';
import { NotFoundError } from 'rxjs';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class ProblemsRepository {
  constructor(private prisma: PrismaService) { }

  async getProblemById(id: number): Promise<Problem | null> {
    const problem = await this.prisma.problem.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          slug: true,
          difficulty: true,
          description: true,
        }
      }
    )
    return problem;
  }

  async getProblemBySlug(slug: string): Promise<Problem | null> {
    const problem = await this.prisma.problem.findUnique({
        where: { slug },
        select: {
          id: true,
          title: true,
          slug: true,
          difficulty: true,
          description: true,
        }
      }
    )
    return problem;
  }

  async findProblems(filter: ProblemFilterDto): Promise<Problem [] | null> {
    const where: Prisma.ProblemWhereInput = {};
    if (filter.difficulty)
      where.difficulty = Array.isArray(filter.difficulty)
        ? { in: filter.difficulty }
        : filter.difficulty;

    const orderBy = filter.sortBy
      ? { [filter.sortBy]: filter.sortOrder || 'asc' }
      : undefined;

    const include =
      filter.includeSubmissions ? { submissions: true } : undefined;

    return await this.prisma.problem.findMany({
      where,
      orderBy,
      include,
      take: filter.limit,
      skip: filter.offset,
    });
  }

  async getProblemDetails(problemId: number): Promise<ProblemDetails>{
    const problem = await this.prisma.problem.findUnique(
      {
        where: { id: problemId },
      }
    );
    if (!problem) {
      throw new NotFoundException(`Problem with id ${problemId} not found`);
    }
    const details: ProblemDetails = {
      MemoryLimit: problem.memoryLimit,
      TimeLimit: problem.timeLimit,
    } ;

    return details;
  }
}