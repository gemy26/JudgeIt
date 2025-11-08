import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionResult } from '../types';

@Injectable()
export class SubmissionsResultsRepository {
  constructor(private prisma: PrismaService) {}

  async addSubmissionResults(submissionResults: SubmissionResult[]) {
    await this.prisma.submissionResult.createMany({
      data: submissionResults
    });
  }
}