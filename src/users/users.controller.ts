import { Controller, Post } from "@nestjs/common";
import { GetCurrentUserId } from '../common/decorators';
import { UserProfile } from '../types';
import { UsersService } from "./users.service";

@Controller('user')
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Post('/profile')
  getProfile(@GetCurrentUserId() userId: string): Promise<UserProfile>{
    return this.usersService.getProfile(userId);
  }


}