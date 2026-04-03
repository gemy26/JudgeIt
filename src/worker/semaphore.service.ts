import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SemaphoreService {
  private count: number;
  private availableBoxes: number[];
  private queue: ((number: number) => void)[] = [];
  private logger: Logger;
  constructor(workers: number) {
    this.count = workers;
    this.logger = new Logger(SemaphoreService.name, { timestamp: true });
    this.availableBoxes = Array.from({ length: workers }, (_, i) => i);
  }

  async acquire(): Promise<number> {
    if (this.count > 0) {
      this.count--;
      return this.availableBoxes.shift()!;
    } else {
      return new Promise<number>((resolve) => this.queue.push(resolve));
    }
  }

  release(boxId: number): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next(boxId);
      }
    } else {
      this.availableBoxes.push(boxId);
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
