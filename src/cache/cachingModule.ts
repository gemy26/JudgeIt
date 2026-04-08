import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { ConfigService } from '@nestjs/config';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        return {
          stores: [new KeyvRedis(config.get<string>('REDIS_CONNECTION'))],
        };
      },
    }),
    MonitoringModule,
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CachingModule {}
