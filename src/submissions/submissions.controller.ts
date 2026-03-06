import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GetCurrentUserId } from '../common/decorators';
import { SubmissionDto } from '../dto';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionsService } from './submissions.service';
import { KafkaProducerService } from 'src/kafka/kafka-producer.service';
import { languages } from '../types/language.config'
import { SubmissionQueuedEvent } from 'src/types';

@Controller('submissions')
export class SubmissionsController {
  constructor(
    private submissionsService: SubmissionsService,
    private kafkaService: KafkaProducerService,
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

    //TODO: Change the static topic name and get it from configs
    await this.kafkaService.sendMessage('submissions', queueEvent);
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
