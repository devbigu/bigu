import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../infrastructure/integrations/integrations.module';
import { SpreadsheetsModule } from '../spreadsheets/spreadsheets.module';
import { ClientWorkspaceController } from './client-workspace.controller';
import { ClientWorkspaceService } from './client-workspace.service';
import { ClientContextService } from './client-context.service';
@Module({
  imports: [IntegrationsModule, SpreadsheetsModule],
  controllers: [ClientWorkspaceController],
  providers: [ClientWorkspaceService, ClientContextService],
})
export class ClientWorkspaceModule {}
