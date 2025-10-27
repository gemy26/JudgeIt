import { Type } from "class-transformer"
import { IsNumber, IsString } from "class-validator"

export class SubmissionDto {
  @Type(() => Number)
  @IsNumber()
  problemId: number;

  @IsString()
  sourceCode: string;

  @IsString()
  language: string; //TODO: should be an enum or env
}