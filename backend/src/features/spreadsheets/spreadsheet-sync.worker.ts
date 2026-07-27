import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SpreadsheetsService } from './spreadsheets.service';

@Injectable()
export class SpreadsheetSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SpreadsheetSyncWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly spreadsheets: SpreadsheetsService) {}

  async onModuleInit() {
    await this.recoverStaleJobsSafely();
    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.spreadsheets.processPendingJobs();
    } catch (error) {
      this.logger.error(
        `Spreadsheet sync worker failed: ${safeErrorMessage(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async recoverStaleJobsSafely() {
    try {
      await this.spreadsheets.recoverStaleJobs();
    } catch (error) {
      this.logger.error(
        `Could not recover stale spreadsheet sync jobs: ${safeErrorMessage(error)}`,
      );
    }
  }
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
