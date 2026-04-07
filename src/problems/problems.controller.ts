import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ProblemFilterDto } from '../dto';
import { ProblemsService } from './problems.service';
import { Public } from '../common/decorators';
import { ApiParam, ApiQuery } from '@nestjs/swagger';

@Public()
@Controller('problems')
export class ProblemsController {
  constructor(private problemsService: ProblemsService) {}
  @Get()
  async getProblems(@Query() filter: ProblemFilterDto) {
    return this.problemsService.getAllProblems(filter);
  }

  @Get('/:id')
  @ApiParam({ name: 'id' })
  async getProblem(@Param('id', ParseIntPipe) id: number) {
    return this.problemsService.getProblemById(id);
  }

  @Get('/slug/:slug')
  @ApiParam({ name: 'slug' })
  async getProblemBySlug(@Param('slug') slug: string) {
    return this.problemsService.getProblemBySlug(slug);
  }
}
