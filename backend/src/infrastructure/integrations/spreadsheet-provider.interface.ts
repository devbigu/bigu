export const SPREADSHEET_PROVIDER = Symbol('SPREADSHEET_PROVIDER');

export type SpreadsheetCellValue = string | number | boolean | null;

export type WorkbookReference = {
  externalWorkbookId: string;
  workbookName: string;
  externalUrl: string;
  overviewWorksheetId: string;
  syncLogWorksheetId: string;
};

export type WorksheetReference = {
  externalWorksheetId: string;
  worksheetName: string;
  worksheetIndex: number;
};

export type SpreadsheetRangeUpdate = {
  range: string;
  values: SpreadsheetCellValue[][];
};

export type SyncResult = {
  updatedRanges: number;
};

export type WorkbookStatus = {
  available: boolean;
  title?: string;
};

export interface SpreadsheetProvider {
  isConfigured(): boolean;
  createClientWorkbook(input: {
    workbookName: string;
  }): Promise<WorkbookReference>;
  createProjectWorksheet(input: {
    externalWorkbookId: string;
    worksheetName: string;
    worksheetIndex: number;
  }): Promise<WorksheetReference>;
  renameWorksheet(input: {
    externalWorkbookId: string;
    externalWorksheetId: string;
    worksheetName: string;
  }): Promise<void>;
  upsertRows(input: {
    externalWorkbookId: string;
    clearRanges: string[];
    updates: SpreadsheetRangeUpdate[];
    hiddenRows?: Array<{
      externalWorksheetId: string;
      startIndex: number;
      endIndex: number;
    }>;
  }): Promise<SyncResult>;
  getWorkbookStatus(input: {
    externalWorkbookId: string;
  }): Promise<WorkbookStatus>;
}

export class SpreadsheetProviderNotConfiguredError extends Error {
  constructor() {
    super('Google Sheets synchronization is not configured.');
    this.name = 'SpreadsheetProviderNotConfiguredError';
  }
}

export function neutralizeSpreadsheetValue(
  value: SpreadsheetCellValue,
): SpreadsheetCellValue {
  if (typeof value !== 'string') return value;
  const bounded = value.slice(0, 49_500);
  return /^[=+\-@]/.test(bounded) ? `'${bounded}` : bounded;
}
