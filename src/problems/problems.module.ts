import { Module } from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { ProblemsController } from './problems.controller';
import { ProblemsRepository } from './problems.repository';

@Module({
  providers: [ProblemsService, ProblemsRepository],
  controllers: [ProblemsController],
  exports: [ProblemsService, ProblemsRepository],
})
export class ProblemsModule {}
