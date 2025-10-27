import { Controller, Get, Post } from "@nestjs/common";
import { GetCurrentUserId } from '../common/decorators';
import { SolvedProblemResult, UserProfile } from '../types';
import { UsersService } from "./users.service";
import { SubmissionsService } from '../submissions/submissions.service';

@Controller('user')
export class UsersController {
  constructor(private usersService: UsersService,
              private submissionsService: SubmissionsService
    ) { }

  @Post('/profile')
  getProfile(@GetCurrentUserId() userId: string): Promise<UserProfile>{
    return this.usersService.getProfile(userId);
  }

  @Get('/solved-problems')
  async getSolvedProblems(@GetCurrentUserId() userId: string): Promise<SolvedProblemResult[]> {
    return this.submissionsService.getSolvedProblems(parseInt(userId));
  }


}