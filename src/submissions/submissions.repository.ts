import { PrismaService } from '../prisma/prisma.service';
import { SolvedProblemResult, SubmissionResponse } from '../types';
import { SubmissionDto } from '../dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SubmissionsRepository {
  constructor(private prisma: PrismaService) {}

  async addSubmission(submissionDto: SubmissionDto, userId: number){

    return await this.prisma.submission.create({
      data: {
        user_id: userId,
        problem_id: submissionDto.problemId,
        language: submissionDto.language,
        source_code: submissionDto.sourceCode,
      },
      include: {
        user: { select: { username: true } },
        problem: { select: { title: true, difficulty: true } },
      },
    });
  }

  async updateSubmission(submissionId: number, verdicate: string){
    return this.prisma.submission.update({
      where: {
        id: submissionId,
      },
      data: {
        verdicate: verdicate,
      }
    })
  }

  async getAllSubmissions(userId : number, verdicate?: string): Promise<SubmissionResponse[]> {
    return this.prisma.submission.findMany({
      where: {
        user_id: userId,
        verdicate: (verdicate ? verdicate : {}),
      },
      include: {
        user: { select: { username: true } },
        problem: { select: { title: true } },
      },
    });
  }

  async getSubmissionDetails(submissionId : number): Promise<SubmissionResponse | null> {
    return this.prisma.submission.findUnique({
      where: {id: submissionId },
      include: {
        user: { select: { username: true } },
        problem: { select: { title: true } },
      },
    })
  };

  async getSolvedProblems(userId: number): Promise<SolvedProblemResult []>{
    return await this.prisma.$queryRaw<
      SolvedProblemResult[]
      >`
    SELECT DISTINCT ON (p.id)
      p.id,
      p.title,
      p.difficulty,
      s.execution_time,
      s.memory_user,
      s.created_at AS solved_at
    FROM "Problem" AS p
    JOIN "Submission" AS s 
      ON s.problem_id = p.id
    WHERE s.user_id = ${userId}
      AND s.verdicate = 'ACCEPTED'
    ORDER BY p.id, s.created_at DESC;
  `;
  }

  async getsolvedProblemsCount(userId: number): Promise<number> {
    const grouped = await this.prisma.submission.groupBy({
      by: ['problem_id'],
      where: {
        user_id: userId,
        verdicate: "ACCEPTED"
      },
      _count: true,
    });

    return grouped.length;
  }

  async getSubmissionsCount(userId: number): Promise<number> {
    const submissionsCount = await this.prisma.submission.count({
      where: { user_id: userId },
    });
    return submissionsCount;
  }
}