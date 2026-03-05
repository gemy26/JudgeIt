import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
