export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface DetectedTableInfo {
  name: string;
  displayName: string;
  sheetName: string;
  sheetIndex: number;
  ref: string;
  columns: string[];
  rowCount: number;
}

export interface TableExpectation {
  key: string;
  primaryName: string;
  aliases: string[];
  critical: boolean;
  expectedColumns: string[];
}

export interface TableValidationFinding {
  key: string;
  name: string;
  sheetName: string | null;
  found: boolean;
  critical: boolean;
  rowCount: number | null;
  detectedColumns: string[];
  missingColumns: string[];
  severity: ValidationSeverity;
  notes: string[];
}

export interface WorkbookValidationReport {
  fileName: string;
  sheetNames: string[];
  detectedTables: DetectedTableInfo[];
  findings: TableValidationFinding[];
  errors: string[];
  warnings: string[];
  invalidDates: string[];
  invalidNumbers: string[];
  currencyIssues: Array<{ currency: string; count: number }>;
  uncategorizedSymbols: string[];
  symbolsWithoutHistory: string[];
  symbolsWithoutCurrentPrice: string[];
}

export interface WorkbookTableData {
  name: string;
  displayName: string;
  sheetName: string;
  sheetIndex: number;
  ref: string;
  columns: string[];
  rowCount: number;
  rows: Array<Record<string, unknown>>;
}

export interface WorkbookSnapshot {
  fileName: string;
  sheetNames: string[];
  tables: WorkbookTableData[];
  validation: WorkbookValidationReport;
}
