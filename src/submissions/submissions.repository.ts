import { PrismaService } from '../prisma/prisma.service';
import { SubmissionResponse } from '../types';
export class SubmissionsRepository {
  constructor(private prisma: PrismaService) {}

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
}