import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { GetCurrentUserId } from '../common/decorators';
import { SubmissionDto } from '../dto';
import { SubmissionsService } from './submissions.service';
import { KafkaProducerService } from 'src/kafka/kafka-producer.service';
import { SubmissionQueuedEvent, PaginationDto } from 'src/types';
import { ConfigService } from '@nestjs/config';

@Controller('submissions')
export class SubmissionsController {
  private logger = new Logger(SubmissionsController.name, { timestamp: true });
  constructor(
    private submissionsService: SubmissionsService,
    private kafkaService: KafkaProducerService,
    private config: ConfigService,
  ) {}

  @Post('/submit')
  async submit(@Body() dto: SubmissionDto, @GetCurrentUserId() userId: string) {
    this.logger.log(`Incoming submission from user ${userId}`);

    const submission = await this.submissionsService.addSubmission(
      dto,
      parseInt(userId),
    );
    this.logger.debug(`Submission created with ID: ${submission.id}`);

    const submissionQueuedEvent: SubmissionQueuedEvent = {
      submissionId: submission.id,
      code: dto.sourceCode,
      problemId: submission.problem_id,
      timestamp: new Date(),
      userId: userId,
      language: submission.language as 'cpp' | 'python',
    };

    this.logger.log(`Sending submission ${submission.id} to Kafka topic`);
    await this.kafkaService.sendMessage(
      this.config.get<string>('KAFKA_SUBMISSIONS_TOPIC')!,
      submissionQueuedEvent,
    );
    this.logger.log(`Submission ${submission.id} queued successfully`);

    return submission;
  }

  @Get('/userSubmissions')
  async getUserSubmissions(
    @GetCurrentUserId(ParseIntPipe) userId: number,
    @Query() { limit, offset }: PaginationDto,
  ) {
    this.logger.log(
      `Fetching submissions for user ${userId} (limit=${limit}, offset=${offset})`,
    );

    return this.submissionsService.getAllSubmissions(
      userId,
      undefined,
      limit,
      offset,
    );
  }

  @Get('/filtered')
  async getfilteredSubmissions(
    @GetCurrentUserId(ParseIntPipe) userId: number,
    @Query() { limit, offset }: PaginationDto,
    @Query('verdict') verdict?: string,
  ) {
    this.logger.log(
      `Fetching filtered submissions for user ${userId} (verdict=${verdict})`,
    );

    return this.submissionsService.getAllSubmissions(
      userId,
      verdict,
      limit,
      offset,
    );
  }

  @Get('/:submissionId')
  async getSubmission(
    @Param('submissionId', ParseIntPipe) submissionId: number,
  ) {
    this.logger.log(`Fetching submission details for ID ${submissionId}`);

    return this.submissionsService.getSubmissionDetails(submissionId);
  }
}
