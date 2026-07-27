import { Module } from '@nestjs/common';
import { AiModule } from '../../infrastructure/ai/ai.module';
import { IntegrationsModule } from '../../infrastructure/integrations/integrations.module';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { ProjectWorkspaceController } from './project-workspace.controller';
import { ProjectWorkspaceService } from './project-workspace.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SopPolicyService } from './sop-policy.service';

@Module({
  imports: [IntegrationsModule, AiModule, SpreadsheetsModule],
  controllers: [ProjectsController, ProjectWorkspaceController],
  providers: [ProjectsService, ProjectWorkspaceService, SopPolicyService],
})
export class ProjectsModule {}
