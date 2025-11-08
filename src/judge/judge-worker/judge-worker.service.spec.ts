import { Test, TestingModule } from '@nestjs/testing';
import { JudgeWorkerService } from './judge-worker.service';

describe('JudgeWorkerService', () => {
  let service: JudgeWorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JudgeWorkerService],
    }).compile();

    service = module.get<JudgeWorkerService>(JudgeWorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
