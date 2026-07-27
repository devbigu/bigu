import { Module } from '@nestjs/common';
import { GrowthPlansController } from './growth-plans.controller';
import { GrowthPlansService } from './growth-plans.service';

@Module({
  controllers: [GrowthPlansController],
  providers: [GrowthPlansService],
})
export class GrowthPlansModule {}
