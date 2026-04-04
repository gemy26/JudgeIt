import { WorkerManagerService } from './worker-manager.service';
import { Test, TestingModule } from '@nestjs/testing';
import { KAFKA_CLIENT } from '../kafka/kafka.constants';
import { ConfigService } from '@nestjs/config';
import { JudgeService } from '../judge/judge.service';

describe('WorkerManagerService', () => {
  let service: WorkerManagerService;
  let eachMessageHandler;
  const mockKafkaClient = {
    consumer: jest.fn().mockImplementation(() => mockConsumer),
  };
  const mockConsumer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockImplementation(({ eachMessage }) => {
      eachMessageHandler = eachMessage;
      return Promise.resolve();
    }),
    pause: jest.fn(),
    resume: jest.fn(),
    commitOffsets: jest.fn().mockResolvedValue(undefined),
  };

  const mockJudgeService = {
    judgeSubmission: jest.fn().mockResolvedValue([]),
  };

  const buildMessage = (value: object | null, offset = '0') => ({
    topic: 'submissions',
    partition: 0,
    message: {
      offset,
      value: value ? Buffer.from(JSON.stringify(value)) : null,
    },
  });
  const makePayload = (id: number) => {
    return {
      submissionId: id,
      code: "print('Hello')",
      problemId: 2,
      timestamp: new Date(),
      userId: 4,
      language: 'python',
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerManagerService,
        {
          provide: KAFKA_CLIENT,
          useValue: mockKafkaClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key, defaultValue) => {
              return defaultValue;
            }),
          },
        },
        {
          provide: JudgeService,
          useValue: mockJudgeService,
        },
      ],
    }).compile();

    service = module.get<WorkerManagerService>(WorkerManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('onModuleInit', async () => {
    await service.onModuleInit();
    expect(mockKafkaClient.consumer).toHaveBeenCalled();
  });

  it('should subscribe to the correct topic', async () => {
    await service.onModuleInit();
    expect(mockConsumer.subscribe).toHaveBeenCalledWith({
      topic: 'submissions',
      fromBeginning: false,
    });
  });

  it('should call judgeSubmission with the parsed payload', async () => {
    const queueMessage = {
      submissionId: 12,
      code: "print('Hello')",
      problemId: 2,
      timestamp: new Date(),
      userId: 4,
      language: 'python',
    };

    await service.onModuleInit();
    await eachMessageHandler(buildMessage(queueMessage));

    expect(mockJudgeService.judgeSubmission).toHaveBeenCalledWith(
      { ...queueMessage, timestamp: queueMessage.timestamp.toISOString() },
      0,
    );
  });
  it('control the backpressure', async () => {
    await service.onModuleInit();
    const resolvers: (() => void)[] = [];
    mockJudgeService.judgeSubmission.mockImplementation(
      () => new Promise((res) => resolvers.push(() => res([]))),
    );

    for (let i = 0; i < 5; i++) {
      await eachMessageHandler(buildMessage(makePayload(i + 1), String(i)));
    }
    await new Promise(process.nextTick);
    mockJudgeService.judgeSubmission.mockReturnValue(new Promise(() => []));

    await new Promise(process.nextTick);

    eachMessageHandler(buildMessage(makePayload(6), String(5)));
    await new Promise(process.nextTick);

    expect(mockConsumer.pause).toHaveBeenCalledTimes(1);
    expect(mockConsumer.pause).toHaveBeenCalledWith([{ topic: 'submissions' }]);

    resolvers[0]();
    await new Promise(process.nextTick);

    expect(mockConsumer.resume).toHaveBeenCalledTimes(1);
    expect(mockConsumer.resume).toHaveBeenCalledWith([
      { topic: 'submissions', partitions: [0] },
    ]);

    resolvers.forEach((r) => r());
  });
});
