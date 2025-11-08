import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GetCurrentUserId } from '../common/decorators';
import { SubmissionDto } from '../dto';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionsService } from './submissions.service';
import { KafkaService } from 'src/kafka/kafka.service';
import { languages } from 'src/execution/language.config';
import { SubmissionQueuedEvent } from 'src/types';

@Controller('submissions')
export class SubmissionsController {
  constructor(
    private submissionsService: SubmissionsService,
    private kafkaService: KafkaService,
  ) {}

  @Post('/submit')
  async submit(@Body() dto: SubmissionDto, @GetCurrentUserId() id: string){

    console.log(id);

    const submission = await this.submissionsService.addSubmission(dto, parseInt(id));

    console.log("Submission:=> ", submission);

    const queueEvent: SubmissionQueuedEvent = {
      submissionId: submission.id,
      code: dto.sourceCode,
      problemId: submission.problem_id,
      timestamp: new Date(),
      userId: id,
      language: submission.language as 'cpp' | 'python',
    };

    await this.kafkaService.sendMessage(queueEvent);
    return submission;
  }

  @Get('/user-submissions')
  async getUserSubmissions(@GetCurrentUserId() id: string){
    const userId = parseInt(id);
    return this.submissionsService.getAllSubmissions(userId, undefined);
  }

  @Get('/:submission_id')
  async getSubmission(@Param() submissionId: string){
    return this.submissionsService.getSubmissionDetails(parseInt(submissionId));
  }

  @Get('/filtered')
  async getfilteredSubmissions(@GetCurrentUserId() id : string, @Query() verdicate: string){
    const userId = parseInt(id);
    return this.submissionsService.getAllSubmissions(userId, verdicate);
  }
}
