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
  async getTestCases(problem_id: number): Promise<TestCase[] | null> {
    const bucket = this.config.get<string>('S3_BUCKET')!;
    const prefix: string = `problems/${problem_id}/testcases/`;
    const fetchTestCasesFromS3 = async () => {
      const files = await this.storage.fetchObjectContents(bucket, prefix);
      const grouped = new Map<string, Partial<TestCase>>();
      for (const { key, content } of files) {
        const fileName = key.split('/').pop() ?? key; // "case1.in"
        const baseName = fileName.replace(/\.(in|out)$/, ''); // "case1"
        const entry = grouped.get(baseName) ?? { name: baseName };
        if (fileName.endsWith('.in')) entry.input = content;
        if (fileName.endsWith('.out')) entry.output = content;
        grouped.set(baseName, entry);
      }
      return [...grouped.values()].filter(
        (tc): tc is TestCase => tc.input !== undefined,
      );
    };
    const testCases = await this.cache.getOrSet<TestCase[]>(
      String(problem_id),
      fetchTestCasesFromS3,
      1200,
    );
    return testCases;
  }
}
