import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
//TODO: Refactor to be an id
export enum Language {
  CPP = 'cpp',
  PYTHON = 'python',
}
export class SubmissionDto {
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({ example: '1' })
  problemId: number;

  @IsString()
  @ApiProperty({ example: '#include <iostream>...' })
  sourceCode: string;

  @IsEnum(Language)
  @ApiProperty({ example: 'cpp', enum: ['cpp', 'python'] })
  language: Language;
}
