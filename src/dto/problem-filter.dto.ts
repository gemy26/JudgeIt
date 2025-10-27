import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class ProblemFilterDto {
  @IsOptional()
  @IsString({ each: true })
  difficulty?: string | string[];

  // Sorting
  @IsOptional()
  @IsIn(['id', 'title', 'created_at', 'difficulty'])
  sortBy?: 'id' | 'title' | 'created_at' | 'difficulty';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;

  // Relations
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeSubmissions?: boolean;
}
