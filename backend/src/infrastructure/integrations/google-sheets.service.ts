import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';
import {
  neutralizeSpreadsheetValue,
  SpreadsheetProvider,
  SpreadsheetProviderNotConfiguredError,
  SyncResult,
  WorkbookReference,
  WorkbookStatus,
  WorksheetReference,
} from './spreadsheet-provider.interface';

type GoogleSheetProperties = {
  properties?: { sheetId?: number; title?: string; index?: number };
};

type GoogleSpreadsheet = {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  properties?: { title?: string };
  sheets?: GoogleSheetProperties[];
  replies?: Array<{ addSheet?: GoogleSheetProperties }>;
};

class GoogleSheetsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleSheetsApiError';
  }
}

@Injectable()
export class GoogleSheetsService implements SpreadsheetProvider {
  private cachedToken?: { token: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get<string>('GOOGLE_SHEETS_ACCESS_TOKEN') ||
      (this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
        this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')),
    );
  }

  async createClientWorkbook(input: {
    workbookName: string;
  }): Promise<WorkbookReference> {
    this.assertConfigured();
    const spreadsheet = await this.request<GoogleSpreadsheet>(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: input.workbookName },
          sheets: [
            {
              properties: {
                title: 'Client Overview',
                index: 0,
                gridProperties: { frozenRowCount: 1 },
              },
            },
            {
              properties: {
                title: 'Sync Log',
                index: 1,
                gridProperties: { frozenRowCount: 1 },
              },
            },
          ],
        }),
      },
    );
    const externalWorkbookId = spreadsheet.spreadsheetId;
    const overview = spreadsheet.sheets?.find(
      (sheet) => sheet.properties?.title === 'Client Overview',
    )?.properties?.sheetId;
    const syncLog = spreadsheet.sheets?.find(
      (sheet) => sheet.properties?.title === 'Sync Log',
    )?.properties?.sheetId;
    if (
      !externalWorkbookId ||
      overview === undefined ||
      syncLog === undefined
    ) {
      throw new Error(
        'Google Sheets returned an incomplete workbook reference.',
      );
    }
    return {
      externalWorkbookId,
      workbookName: spreadsheet.properties?.title ?? input.workbookName,
      externalUrl:
        spreadsheet.spreadsheetUrl ??
        `https://docs.google.com/spreadsheets/d/${externalWorkbookId}/edit`,
      overviewWorksheetId: String(overview),
      syncLogWorksheetId: String(syncLog),
    };
  }

  async createProjectWorksheet(input: {
    externalWorkbookId: string;
    worksheetName: string;
    worksheetIndex: number;
  }): Promise<WorksheetReference> {
    this.assertConfigured();
    const result = await this.request<GoogleSpreadsheet>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.externalWorkbookId)}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: input.worksheetName,
                  index: input.worksheetIndex,
                  gridProperties: { frozenRowCount: 1 },
                },
              },
            },
          ],
        }),
      },
    );
    const properties = result.replies?.[0]?.addSheet?.properties;
    if (properties?.sheetId === undefined) {
      throw new Error('Google Sheets did not return the new worksheet ID.');
    }
    return {
      externalWorksheetId: String(properties.sheetId),
      worksheetName: properties.title ?? input.worksheetName,
      worksheetIndex: properties.index ?? input.worksheetIndex,
    };
  }

  async renameWorksheet(input: {
    externalWorkbookId: string;
    externalWorksheetId: string;
    worksheetName: string;
  }) {
    this.assertConfigured();
    await this.request(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.externalWorkbookId)}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: Number(input.externalWorksheetId),
                  title: input.worksheetName,
                },
                fields: 'title',
              },
            },
          ],
        }),
      },
    );
  }

  async upsertRows(input: {
    externalWorkbookId: string;
    clearRanges: string[];
    hiddenRows?: Array<{
      externalWorksheetId: string;
      startIndex: number;
      endIndex: number;
    }>;
    updates: Array<{
      range: string;
      values: Array<Array<string | number | boolean | null>>;
    }>;
  }): Promise<SyncResult> {
    this.assertConfigured();
    const id = encodeURIComponent(input.externalWorkbookId);
    if (input.clearRanges.length > 0) {
      await this.request(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchClear`,
        {
          method: 'POST',
          body: JSON.stringify({ ranges: input.clearRanges }),
        },
      );
    }
    if (input.updates.length > 0) {
      await this.request(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: input.updates.map((update) => ({
              range: update.range,
              majorDimension: 'ROWS',
              values: update.values.map((row) =>
                row.map(neutralizeSpreadsheetValue),
              ),
            })),
          }),
        },
      );
    }
    if (input.hiddenRows?.length) {
      await this.request(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            requests: input.hiddenRows.map((row) => ({
              updateDimensionProperties: {
                range: {
                  sheetId: Number(row.externalWorksheetId),
                  dimension: 'ROWS',
                  startIndex: row.startIndex,
                  endIndex: row.endIndex,
                },
                properties: { hiddenByUser: true },
                fields: 'hiddenByUser',
              },
            })),
          }),
        },
      );
    }
    return { updatedRanges: input.updates.length };
  }

  async getWorkbookStatus(input: {
    externalWorkbookId: string;
  }): Promise<WorkbookStatus> {
    this.assertConfigured();
    try {
      const result = await this.request<GoogleSpreadsheet>(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.externalWorkbookId)}?fields=spreadsheetId,properties.title`,
        { method: 'GET' },
      );
      return {
        available: Boolean(result.spreadsheetId),
        title: result.properties?.title,
      };
    } catch (error) {
      if (error instanceof GoogleSheetsApiError && error.status === 404) {
        return { available: false };
      }
      throw error;
    }
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new SpreadsheetProviderNotConfiguredError();
    }
  }

  private async request<T = unknown>(
    url: string,
    init: { method: string; body?: string },
  ): Promise<T> {
    const token = await this.accessToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new GoogleSheetsApiError(
        response.status,
        `Google Sheets request failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  private async accessToken() {
    const configuredToken = this.config.get<string>(
      'GOOGLE_SHEETS_ACCESS_TOKEN',
    );
    if (configuredToken) return configuredToken;
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.token;
    }

    const email = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const configuredKey = this.config.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    );
    if (!email || !configuredKey) {
      throw new SpreadsheetProviderNotConfiguredError();
    }
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64Url(
      JSON.stringify({
        iss: email,
        scope:
          'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const unsigned = `${header}.${claim}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const signature = signer
      .sign(configuredKey.replace(/\\n/g, '\n'))
      .toString('base64url');
    const assertion = `${unsigned}.${signature}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !payload.access_token) {
      throw new Error(
        `Google service account authentication failed: ${payload.error ?? response.status}`,
      );
    }
    this.cachedToken = {
      token: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };
    return payload.access_token;
  }
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}
