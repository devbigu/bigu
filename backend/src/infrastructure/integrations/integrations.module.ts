import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiService } from './ai.service';
import { GoogleSheetsService } from './google-sheets.service';
import { SPREADSHEET_PROVIDER } from './spreadsheet-provider.interface';
import { StorageService } from './storage.service';

@Module({
  imports: [AiModule],
  providers: [
    AiService,
    GoogleSheetsService,
    StorageService,
    { provide: SPREADSHEET_PROVIDER, useExisting: GoogleSheetsService },
  ],
  exports: [AiService, StorageService, SPREADSHEET_PROVIDER],
})
export class IntegrationsModule {}
