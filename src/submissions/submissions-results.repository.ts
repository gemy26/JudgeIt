import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionResult } from '../types';

@Injectable()
export class SubmissionsResultsRepository {
  private logger = new Logger(SubmissionsResultsRepository.name);

  constructor(private prisma: PrismaService) {}

  async addSubmissionResults(submissionResults: SubmissionResult[]) {
    this.logger.log(
      `Inserting submission results (count=${submissionResults.length})`,
    );

    try {
      const result = await this.prisma.submissionResult.createMany({
        data: submissionResults,
      });

      this.logger.debug(
        `Inserted ${result.count} submission results successfully`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to insert submission results`, error.stack);

      throw error;
    }
  }
}
