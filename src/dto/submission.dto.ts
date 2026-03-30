import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString } from 'class-validator';
//TODO: Refactor to be an id
export enum Language {
  CPP = 'cpp',
  PYTHON = 'python',
}
export class SubmissionDto {
  @Type(() => Number)
  @IsNumber()
  problemId: number;

  @IsString()
  sourceCode: string;

  @IsEnum(Language)
  language: Language;
}
