import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto{
  @IsNotEmpty()
  @IsString()
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}