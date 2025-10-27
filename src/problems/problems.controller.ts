import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProblemFilterDto } from '../dto';
import { ProblemsService } from './problems.service';
import { Public } from '../common/decorators';

@Public()
@Controller('problems')
export class ProblemsController {
  constructor(private problemsService: ProblemsService){}
  @Get()
  async getProblems(@Query() filter: ProblemFilterDto){
    return this.problemsService.getAllProblems(filter);
  }

  @Get('/:id')
  async getProblem(@Param() id: string){
    const Id = parseInt(id);
    return this.problemsService.getProblemById(Id);
  }

  @Get('/:slug')
  async getProblemBySlug(@Param() slug: string){
    return this.problemsService.getProblemBySlug(slug);
  }

}
