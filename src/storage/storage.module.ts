import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [MonitoringModule],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule { }
