import { PrismaService } from '../prisma/prisma.service';
import {
  SolvedProblemResult,
  SubmissionListResponse,
  SubmissionResponse,
} from '../types';
import { SubmissionDto } from '../dto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

@Injectable()
export class SubmissionsRepository {
  private logger = new Logger(SubmissionsRepository.name, { timestamp: true });
  constructor(private prisma: PrismaService) {}

  async addSubmission(submissionDto: SubmissionDto, userId: number) {
    this.logger.debug(`DB: Creating submission for user ${userId}`);

    const problem = await this.prisma.problem.findUnique({
      where: { id: Number(submissionDto.problemId) },
      select: { id: true },
    });

    if (!problem) {
      throw new NotFoundException(
        `Problem #${submissionDto.problemId} not found`,
      );
    }

    return await this.prisma.submission.create({
      data: {
        user_id: userId,
        problem_id: Number(submissionDto.problemId),
        language: submissionDto.language,
        source_code: submissionDto.sourceCode,
      },
      include: {
        user: { select: { username: true } },
        problem: { select: { title: true, difficulty: true } },
      },
    });
  }

  async updateSubmission(submissionId: number, verdict: string) {
    return this.prisma.submission.update({
      where: {
        id: submissionId,
      },
      data: {
        verdicate: verdict,
      },
    });
  }

  async getAllSubmissions(
    userId: number,
    verdict?: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<SubmissionListResponse> {
    const where = {
      user_id: userId,
      ...(verdict ? { verdicate: verdict } : {}),
    };

    const [submissions, count] = await this.prisma.$transaction([
      this.prisma.submission.findMany({
        where: where,
        skip: offset,
        take: limit,
        include: {
          user: { select: { username: true } },
          problem: { select: { title: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    this.logger.debug(
      `DB: Retrieved ${submissions.length} submissions (total=${count})`,
    );

    return {
      data: submissions,
      pagination: {
        total: count,
        total_pages: Math.ceil(count / limit),
        page: Math.floor(offset / limit) + 1,
        per_page: limit,
      },
    };
  }

  async getSubmissionDetails(
    submissionId: number,
  ): Promise<SubmissionResponse | null> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        user: { select: { username: true } },
        problem: { select: { title: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission #${submissionId} not found`);
    }
    return submission;
  }

  async getSolvedProblems(userId: number): Promise<SolvedProblemResult[]> {
    return await this.prisma.$queryRaw<SolvedProblemResult[]>`
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
        verdicate: 'ACCEPTED',
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
