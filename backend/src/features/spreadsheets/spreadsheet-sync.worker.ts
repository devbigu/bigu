import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SpreadsheetsService } from './spreadsheets.service';

@Injectable()
export class SpreadsheetSyncWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly spreadsheets: SpreadsheetsService) {}

  async onModuleInit() {
    await this.spreadsheets.recoverStaleJobs();
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
    } finally {
      this.running = false;
    }
  }
}
