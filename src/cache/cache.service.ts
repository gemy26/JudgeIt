import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name, { timestamp: true });
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = (await this.cache.get<T>(key)) ?? null;
    if (value !== null) {
      this.logger.debug(`HIT key=${key}`);
    } else {
      this.logger.debug(`MISS key=${key}`);
    }
    return value;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl);
    this.logger.debug(`SET key=${key} ttl=${ttl ?? 'default'}`);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
    this.logger.debug(`DEL key=${key}`);
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T | null>,
    ttl?: number,
  ): Promise<T | null> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    if (this.inFlight.has(key)) {
      this.logger.debug(`COALESCED key=${key}`);
      return this.inFlight.get(key) as Promise<T | null>;
    }

    this.logger.debug(`FETCH key=${key}`);
    const promise = fetchFn()
      .then(async (data) => {
        if (data !== null) {
          await this.set(key, data, ttl);
        } else {
          this.logger.warn(`FETCH returned null, skipping cache key=${key}`);
        }
        return data;
      })
      .catch((error) => {
        this.logger.error(`FETCH failed key=${key}`, error?.stack ?? error);
        throw error;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, promise);
    return promise;
  }
}
