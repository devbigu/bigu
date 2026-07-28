import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { GrowthPlansController } from './growth-plans.controller';
import { GrowthPlansService } from './growth-plans.service';

@Module({
  imports: [PrismaModule],
  controllers: [GrowthPlansController],
  providers: [GrowthPlansService],
})
export class GrowthPlansModule {}
