import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OffsetTrackerService {
  private logger: Logger;

  // partition → sorted set of in-flight offsets
  private inFlight = new Map<number, Set<bigint>>();
  // partition → highest contiguous offset safely committed
  private committed = new Map<number, bigint>();

  constructor() {
    this.logger = new Logger(OffsetTrackerService.name, { timestamp: true });
  }

  // Commit an offset
  complete(partition: number, offset: string): string | null {
    const set = this.inFlight.get(partition);
    if (!set) {
      this.logger.warn(`complete() called on untracked partition=${partition}`);
      return null;
    }

    set.delete(BigInt(offset));

    if (set.size === 0) {
      this.committed.set(partition, BigInt(offset));
      return offset;
    }

    const lowestPending = [...set].reduce((min, val) =>
      val < min ? val : min,
    );
    const safeOffset = lowestPending - 1n;
    const lastCommited = this.committed.get(partition) ?? -1n;
    if (safeOffset > lastCommited) {
      this.committed.set(partition, safeOffset);
      this.logger.debug(
        `partition=${partition} offset=${offset} safe to commit up to ${safeOffset} (pending=${set.size})`,
      );
      return safeOffset.toString();
    }
    return null;
  }

  // Add new message to be commited
  track(partition: number, offset: string) {
    if (!this.inFlight.has(partition)) {
      this.logger.log(`Tracking new partition=${partition}`);
      this.inFlight.set(partition, new Set());
    }
    this.inFlight.get(partition)?.add(BigInt(offset));
  }

  getCommitted(partition: number): string | null {
    const val = this.committed.get(partition);
    return val !== undefined ? val.toString() : null;
  }

  clear(partition: number): void {
    this.logger.log(`Clearing partition=${partition}`);
    this.inFlight.delete(partition);
    this.committed.delete(partition);
  }
}
