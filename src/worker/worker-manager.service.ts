import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SemaphoreService } from './semaphore.service';
import { KAFKA_CLIENT } from '../kafka/kafka.constants';
import { Consumer, Kafka } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { JudgeService } from '../judge/judge.service';
import { OffsetTrackerService } from './offset-Tracker.service';
import { MetricService } from '../monitoring/metricService';

@Injectable()
export class WorkerManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;
  private topic;
  private semaphore: SemaphoreService;
  private workers;
  private consumer: Consumer;
  private isPaused = false;
  private offsetTracker: OffsetTrackerService;
  constructor(
    @Inject(KAFKA_CLIENT) private readonly kafkaClient: Kafka,
    private readonly config: ConfigService,
    private judgeService: JudgeService,
    private metricService: MetricService,
  ) {
    this.logger = new Logger(WorkerManagerService.name, { timestamp: true });
    this.topic = this.config.get<string>('KAFKA_TOPIC', 'submissions');
    this.workers = this.config.get<number>('MAX_WORKERS', 5);

    this.semaphore = new SemaphoreService(this.workers);
    this.offsetTracker = new OffsetTrackerService();

    this.consumer = this.kafkaClient.consumer({
      groupId: this.config.get<string>('KAFKA_GROUP_ID', 'judge-worker-group'),
      sessionTimeout: 60000,
      heartbeatInterval: 20000,

      maxBytesPerPartition: 1048576, // 1MB per partition per fetch
      maxWaitTimeInMs: 500,

      retry: { retries: 10 },
    });
  }
  async onModuleDestroy() {
    await this.consumer.disconnect();
    this.logger.log('Kafka consumer disconnected.');
  }
  async onModuleInit() {
    await this.consumer.connect();

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.consumer.subscribe({
          topic: this.topic,
          fromBeginning: false,
        });

        //Start consuming
        await this.consumer.run({
          autoCommit: false,
          eachMessage: async ({ topic, partition, message }) => {
            const offset = message.offset;
            this.offsetTracker.track(partition, offset);
            const boxId = await this.acquireOrPause(topic);
            this.metricService.messageQueueConsumerConsumedTotal.inc();
            this.processMessage(
              topic,
              partition,
              offset,
              message.value,
              boxId,
            ).catch((err) => {
              this.logger.error(`Unhandled error on offset ${offset}`, err);
              this.metricService.messageQueueConsumerErrorsTotal.inc();
            });
          },
        });
        this.logger.log('Kafka consumer started successfully');
        return;
      } catch (err) {
        this.metricService.messageQueueConsumerErrorsTotal.inc();
        this.logger.warn(
          `Kafka consumer startup attempt ${attempt}/${maxRetries} failed: ${err.message}`,
        );
        if (attempt === maxRetries) {
          this.logger.error('Kafka consumer failed to start after all retries');
          throw err;
        }
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  private async acquireOrPause(topic: string) {
    // If no slots available, pause the partition so Kafka stops pushing messages
    this.semaphore.status();
    if (!this.isPaused && this.semaphore.available === 0) {
      this.isPaused = true;
      this.consumer.pause([{ topic }]);
      this.logger.debug(`topic paused — semaphore full`);
    }

    return await this.semaphore.acquire();
  }

  private async processMessage(
    topic,
    partition,
    offset,
    message,
    boxId: number,
  ) {
    if (!message) {
      this.logger.warn(`Empty message at offset ${offset}, skipping`);
      return;
    }

    try {
      const payload = JSON.parse(message.toString());
      const results: string[] = await this.judgeService.judgeSubmission(
        payload,
        boxId,
      );
      this.logger.debug(`Judge message sent with : ${results.length} results`);
    } catch (err) {
      this.logger.error('Error while processing submission', err.stack);
      //TODO: Push to dlq or change submission state
    } finally {
      this.semaphore.release(boxId);
      if (this.isPaused) {
        this.consumer.resume([{ topic, partitions: [partition] }]);
        this.isPaused = false;
        this.logger.debug(`Partition ${partition} resumed`);
      }

      const safeOffset = this.offsetTracker.complete(partition, offset);
      if (safeOffset !== null) {
        try {
          await this.consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (BigInt(safeOffset) + 1n).toString(),
            },
          ]);
        } catch (commitErr) {
          this.logger.warn(
            `Offset commit failed for ${offset}: ${commitErr.message}`,
          );
        }
      }
    }
  }
}
