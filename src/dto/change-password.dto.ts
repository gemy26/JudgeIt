import { IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  oldPass: string;

  @IsNotEmpty()
  newPass: string;
}