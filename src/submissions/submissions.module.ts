import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsRepository } from './submissions.repository';

@Module({
  providers: [SubmissionsService, SubmissionsRepository],
  controllers: [SubmissionsController],
  exports: [SubmissionsService, SubmissionsRepository],
})
export class SubmissionsModule {}
