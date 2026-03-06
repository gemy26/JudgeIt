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
    let set = this.inFlight.get(partition);
    if (!set) {
      return null;
    }

    if (set.size === 0) {
      this.committed.set(partition, BigInt(offset));
      return offset;
    }

    set.delete(BigInt(offset));
    let lowestPending = BigInt(offset);
    for (const partition of set) {
      if (lowestPending >= partition) {
        lowestPending = partition;
      }
    }
    const safeOffset = lowestPending - 1n;
    let lastCommited = this.committed.get(partition) ?? -1n;
    if (safeOffset > lastCommited) {
      this.committed.set(partition, lastCommited);
      return safeOffset.toString();
    }
    return null;
  }

  // Add new message to be commited
  track(partition: number, offset: string) {
    if (!this.inFlight.has(partition)) {
      this.inFlight.set(partition, new Set());
    }
    this.inFlight.get(partition)?.add(BigInt(offset));
  }


  getCommitted(partition: number): string | null {
    const val = this.committed.get(partition);
    return val !== undefined ? val.toString() : null;
  }

  clear(partition: number): void {
    this.inFlight.delete(partition);
    this.committed.delete(partition);
  }
}
