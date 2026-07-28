import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ListGrowthPlansQueryDto } from './dto/list-growth-plans-query.dto';
import { GrowthPlansService } from './growth-plans.service';

@Controller('growth-plans')
@UseGuards(JwtAuthGuard)
export class GrowthPlansController {
  constructor(private readonly growthPlans: GrowthPlansService) {}

  @Get()
  list(@Query() query: ListGrowthPlansQueryDto) {
    return this.growthPlans.list(query);
  }

  @Get(':projectId')
  detail(@Param('projectId') projectId: string) {
    return this.growthPlans.detail(projectId);
  }
}
