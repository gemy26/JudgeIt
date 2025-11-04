import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BoxManager {
  private readonly MAX_BOXES = 100; // 0-99
  private readonly POOL_KEY = 'isolate:box:pool';
  private readonly LOCK_PREFIX = 'isolate:box:lock:';
  private readonly LOCK_TTL = 90; // seconds
  constructor(
    @Inject("REDIS_CLIENT") private redis: Redis,
    private config: ConfigService
  ) {}

  async onModuleInit(){
    await this.initializePool();
  }

  async initializePool(): Promise<void> {
    const poolSize = await this.redis.scard(this.POOL_KEY); //return the number of elements stored in a set.

    if(poolSize === 0){
      console.log('Initializing box ID pool...');
      const boxIds = Array.from({ length: this.MAX_BOXES }, (_, i) => i);
      if (boxIds.length > 0) {
        await this.redis.sadd(this.POOL_KEY, ...boxIds);
      }
      console.log(`Pool initialized with ${this.MAX_BOXES} boxes`);
    }
  }

  async acquireBoxId(): Promise<number | null> {
    const boxId = await this.redis.spop(this.POOL_KEY);
    if(boxId === null){
      console.log('No available box IDs in pool');
      return null;
    }
    const id = parseInt(boxId);
    await this.redis.setex(
      `${this.LOCK_PREFIX}${id}`,
      this.LOCK_TTL,
      Date.now().toString()
    );
    console.debug(`Box ${id} acquired`);
    return id;
  }

  async releaseBoxId(boxId: number): Promise<void>{
    const key = `${this.LOCK_PREFIX}${boxId}`;
    await this.redis.del(key);
    await this.redis.sadd(this.POOL_KEY, boxId);
    console.debug(`Box ${boxId} released`);
  }

  async getPoolStats(): Promise<{ available: number; inUse: number; total: number; }> {
    const available = await this.redis.scard(this.POOL_KEY);
    const total = this.MAX_BOXES;
    const inUse = total - available;

    return { available, inUse, total };
  }

  async resetPool(): Promise<void> {
    console.warn('Resetting entire box pool...');
    const lockKeys = await this.redis.keys(`${this.LOCK_PREFIX}*`);
    if (lockKeys.length > 0) {
      await this.redis.del(...lockKeys);
    }

    await this.redis.del(this.POOL_KEY);
    await this.initializePool();

    console.log('Pool reset complete');
  }

  async cleanupStuckBoxes(): Promise<number> {
    const lockKeys = await this.redis.keys(`${this.LOCK_PREFIX}*`);
    let cleaned = 0;

    for (const key of lockKeys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        // No TTL set, remove it
        const boxId = parseInt(key.replace(this.LOCK_PREFIX, ''));
        await this.releaseBoxId(boxId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} stuck boxes`);
    }

    return cleaned;
  }
}