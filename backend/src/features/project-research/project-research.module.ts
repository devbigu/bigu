import { Module } from '@nestjs/common';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { ProjectResearchController } from './project-research.controller';
import { ProjectResearchService } from './project-research.service';
import { SopPolicyService } from '../projects/sop-policy.service';

@Module({
  imports: [AiModule, SpreadsheetsModule],
  controllers: [ProjectResearchController],
  providers: [ProjectResearchService, SopPolicyService],
  exports: [ProjectResearchService],
})
export class ProjectResearchModule {}
