import { Module } from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { ProblemsController } from './problems.controller';
import { ProblemsRepository } from './problems.repository';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [ProblemsService, ProblemsRepository, PrismaService],
  controllers: [ProblemsController],
  exports: [ProblemsService, ProblemsRepository],
})
export class ProblemsModule {}
