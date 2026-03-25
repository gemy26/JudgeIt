import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { TestCase } from '../../types';

@Injectable()
export class TestCasesService {
  logger: Logger;
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.logger = new Logger(TestCasesService.name, { timestamp: true });
  }
  async getTestCases(problem_id: number): Promise<TestCase[]> {
    const bucket = this.config.get<string>('S3_BUCKET')!;
    const prefix = `problems/${problem_id}/testcases/`;

    this.logger.debug(`Fetching test cases for problem=${problem_id}`);

    const fetchTestCasesFromS3 = async () => {
      this.logger.debug(
        `Cache miss — fetching from S3 bucket=${bucket} prefix=${prefix}`,
      );

      const files = await this.storage.fetchObjectContents(bucket, prefix);
      this.logger.debug(
        `Fetched ${files.length} files from S3 for problem=${problem_id}`,
      );

      const grouped = new Map<string, Partial<TestCase>>();
      for (const { key, content } of files) {
        const fileName = key.split('/').pop() ?? key;
        const baseName = fileName.replace(/\.(in|out)$/, '');
        const entry = grouped.get(baseName) ?? { name: baseName };
        if (fileName.endsWith('.in')) entry.input = content;
        if (fileName.endsWith('.out')) entry.output = content;
        grouped.set(baseName, entry);
      }

      const testCases = [...grouped.values()].filter(
        (tc): tc is TestCase => tc.input !== undefined,
      );

      this.logger.debug(
        `Parsed ${testCases.length} test cases for problem=${problem_id} (${grouped.size - testCases.length} dropped — missing .in)`,
      );

      return testCases;
    };

    const testCases = await this.cache.getOrSet<TestCase[]>(
      `test-cases:${problem_id}`,
      fetchTestCasesFromS3,
      1200,
    );

    this.logger.debug(
      `Returning ${testCases?.length ?? 0} test cases for problem=${problem_id}`,
    );
    return testCases ?? [];
  }
}
