import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../infrastructure/integrations/integrations.module';
import { SpreadsheetSyncWorker } from './spreadsheet-sync.worker';
import { SpreadsheetsController } from './spreadsheets.controller';
import { SpreadsheetsService } from './spreadsheets.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [SpreadsheetsController],
  providers: [SpreadsheetsService, SpreadsheetSyncWorker],
  exports: [SpreadsheetsService],
})
export class SpreadsheetsModule {}
