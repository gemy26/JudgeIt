import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SemaphoreService {
  private count: number;
  private queue: (() => void)[] = [];
  private logger: Logger;
  constructor(workers: number) {
    this.count = workers;
    this.logger = new Logger(SemaphoreService.name, { timestamp: true });
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
    } else {
      return  new Promise<void>((resolve) => this.queue.push(resolve));
    }
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    } else {
      this.count++;
    }
  }

  status(): void {
    this.logger.debug(
      `Semaphore status: count=${this.count}, queueLength=${this.queue.length}`,
    );
  }

  get available(): number {
    return this.count;
  }

  get pending(): number {
    return this.queue.length;
  }
}
