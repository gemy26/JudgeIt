import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsRepository } from './submissions.repository';
import { KafkaModule } from 'src/kafka/kafka.module';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionsResultsRepository } from './submissions-results.repository';

@Module({
  imports: [KafkaModule],
  providers: [SubmissionsService, SubmissionsRepository, PrismaService, SubmissionsResultsRepository],
  controllers: [SubmissionsController],
  exports: [SubmissionsService, SubmissionsRepository, SubmissionsResultsRepository],
})
export class SubmissionsModule {}
