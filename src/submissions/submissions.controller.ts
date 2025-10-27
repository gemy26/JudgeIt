import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GetCurrentUserId } from '../common/decorators';
import { SubmissionDto } from '../dto';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @Post('/submit')
  async submit(@Body() dto: SubmissionDto, @GetCurrentUserId() id: string){
    // TODO: implement the Submit logic  i have 2 options 1 - return submission id and then the client route and ask for that submission details
    // 2 - wait until judging finish and return response
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
