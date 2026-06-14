import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { DataNormalizationService } from './data-normalization.service';
import { WorkbookMappingService } from './workbook-mapping.service';
import { columnIndexToName, parseTableRef } from '../utils/excel.utils';
import { excelSerialToDate, parseExcelDate } from '../utils/value-parsing.utils';
import { DetectedTableInfo, TableValidationFinding, WorkbookSnapshot, WorkbookTableData, WorkbookValidationReport, ValidationSeverity } from '../models/workbook.models';

type ZipEntryMap = Record<string, JSZip.JSZipObject>;

@Injectable({ providedIn: 'root' })
export class ExcelImportService {
  constructor(
    private readonly normalization: DataNormalizationService,
    private readonly mapping: WorkbookMappingService
  ) {}

  async importWorkbook(file: File): Promise<WorkbookSnapshot> {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const entryMap = this.buildEntryMap(zip);
    const percentStyleIds = await this.readPercentStyleIds(entryMap);
    const dateStyleIds = await this.readDateStyleIds(entryMap);
    const sharedStrings = await this.readSharedStrings(entryMap);
    const workbookXml = this.parseXml(await this.readEntry(entryMap, 'xl/workbook.xml'));
    const workbookRels = this.parseXml(await this.readEntry(entryMap, 'xl/_rels/workbook.xml.rels'));
    const workbookDate1904 = workbookXml.querySelector('workbookPr')?.getAttribute('date1904') === '1';
    const invalidDates: string[] = [];
    const sheetNodes = Array.from(workbookXml.querySelectorAll('sheet'));
    const relTargetById = new Map<string, string>();
    workbookRels.querySelectorAll('Relationship').forEach((node) => {
      relTargetById.set(node.getAttribute('Id') ?? '', node.getAttribute('Target') ?? '');
    });

    const detectedTables: DetectedTableInfo[] = [];
    const tables: WorkbookTableData[] = [];
    const sheetNames: string[] = [];

    for (let index = 0; index < sheetNodes.length; index += 1) {
      const sheetNode = sheetNodes[index];
      const sheetName = sheetNode.getAttribute('name') ?? `Sheet${index + 1}`;
      sheetNames.push(sheetName);

      const sheetXmlPath = `xl/worksheets/sheet${index + 1}.xml`;
      const sheetRelsPath = `xl/worksheets/_rels/sheet${index + 1}.xml.rels`;
      const sheetXmlContent = await this.readEntry(entryMap, sheetXmlPath);
      const sheetXml = this.parseXml(sheetXmlContent);
      const cellMap = this.extractCellMap(sheetXml, sharedStrings, percentStyleIds, dateStyleIds);
      const sheetRelsContent = await this.readOptionalEntry(entryMap, sheetRelsPath);

      if (!sheetRelsContent) {
        continue;
      }

      const sheetRels = this.parseXml(sheetRelsContent);
      const tableRelationships = Array.from(sheetRels.querySelectorAll('Relationship')).filter((rel) =>
        (rel.getAttribute('Type') ?? '').includes('/table')
      );

      for (const relation of tableRelationships) {
        const tableTarget = relation.getAttribute('Target') ?? '';
        const tableXmlPath = `xl/${tableTarget.replace(/^\.{2}\//, '')}`;
        const tableXmlContent = await this.readOptionalEntry(entryMap, tableXmlPath);
        if (!tableXmlContent) {
          continue;
        }
        const tableXml = this.parseXml(tableXmlContent);
        const tableNode = tableXml.querySelector('table');
        if (!tableNode) {
          continue;
        }
        const tableName = tableNode.getAttribute('name') ?? '';
        const displayName = tableNode.getAttribute('displayName') ?? tableName;
        const ref = tableNode.getAttribute('ref') ?? '';
        const columns = Array.from(tableXml.querySelectorAll('tableColumn')).map((node) => node.getAttribute('name') ?? '');
        const rows = this.extractRowsFromTable(ref, columns, cellMap, workbookDate1904, invalidDates, tableName);
        const info: DetectedTableInfo = {
          name: tableName,
          displayName,
          sheetName,
          sheetIndex: index + 1,
          ref,
          columns,
          rowCount: rows.length
        };
        detectedTables.push(info);
        tables.push({
          ...info,
          rows
        });
      }
    }

    const validation = this.buildValidationReport(file.name, sheetNames, detectedTables, tables, invalidDates);
    return {
      fileName: file.name,
      sheetNames,
      tables,
      validation
    };
  }

  private buildEntryMap(zip: JSZip): ZipEntryMap {
    const map: ZipEntryMap = {};
    zip.forEach((relativePath, file) => {
      map[relativePath] = file;
    });
    return map;
  }

  private async readEntry(entries: ZipEntryMap, path: string): Promise<string> {
    const file = entries[path];
    if (!file) {
      throw new Error(`Missing workbook entry: ${path}`);
    }
    return file.async('string');
  }

  private async readOptionalEntry(entries: ZipEntryMap, path: string): Promise<string | null> {
    const file = entries[path];
    if (!file) {
      return null;
    }
    return file.async('string');
  }

  private parseXml(content: string): Document {
    const parser = new DOMParser();
    const document = parser.parseFromString(content, 'application/xml');
    const error = document.querySelector('parsererror');
    if (error) {
      throw new Error(error.textContent ?? 'Invalid XML content');
    }
    return document;
  }

  private async readSharedStrings(entries: ZipEntryMap): Promise<string[]> {
    const content = await this.readOptionalEntry(entries, 'xl/sharedStrings.xml');
    if (!content) {
      return [];
    }
    const xml = this.parseXml(content);
    return Array.from(xml.querySelectorAll('si')).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  }

  private async readPercentStyleIds(entries: ZipEntryMap): Promise<Set<number>> {
    const content = await this.readOptionalEntry(entries, 'xl/styles.xml');
    if (!content) {
      return new Set<number>();
    }
    const xml = this.parseXml(content);
    const percentNumFmtIds = new Set<number>([9, 10]);
    xml.querySelectorAll('numFmt').forEach((node) => {
      const id = Number(node.getAttribute('numFmtId'));
      const formatCode = node.getAttribute('formatCode') ?? '';
      if (Number.isFinite(id) && /%/.test(formatCode)) {
        percentNumFmtIds.add(id);
      }
    });

    const xfs = Array.from(xml.querySelectorAll('cellXfs xf'));
    const percentStyleIds = new Set<number>();
    xfs.forEach((node, index) => {
      const numFmtId = Number(node.getAttribute('numFmtId'));
      if (percentNumFmtIds.has(numFmtId)) {
        percentStyleIds.add(index);
      }
    });

    return percentStyleIds;
  }

  private async readDateStyleIds(entries: ZipEntryMap): Promise<Set<number>> {
    const content = await this.readOptionalEntry(entries, 'xl/styles.xml');
    if (!content) {
      return new Set<number>();
    }
    const xml = this.parseXml(content);
    const dateNumFmtIds = new Set<number>([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
    xml.querySelectorAll('numFmt').forEach((node) => {
      const id = Number(node.getAttribute('numFmtId'));
      const formatCode = node.getAttribute('formatCode') ?? '';
      if (Number.isFinite(id) && /(d|y|m|h|s)/i.test(formatCode)) {
        dateNumFmtIds.add(id);
      }
    });

    const xfs = Array.from(xml.querySelectorAll('cellXfs xf'));
    const dateStyleIds = new Set<number>();
    xfs.forEach((node, index) => {
      const numFmtId = Number(node.getAttribute('numFmtId'));
      if (dateNumFmtIds.has(numFmtId)) {
        dateStyleIds.add(index);
      }
    });

    return dateStyleIds;
  }

  private extractCellMap(
    sheetXml: Document,
    sharedStrings: string[],
    percentStyleIds: Set<number>,
    dateStyleIds: Set<number>
  ): Map<string, unknown> {
    const map = new Map<string, unknown>();
    const rows = Array.from(sheetXml.querySelectorAll('sheetData row'));
    for (const row of rows) {
      for (const cell of Array.from(row.querySelectorAll('c'))) {
        const reference = cell.getAttribute('r');
        if (!reference) {
          continue;
        }
        map.set(reference, this.readCellValue(cell, sharedStrings, percentStyleIds, dateStyleIds));
      }
    }
    return map;
  }

  private readCellValue(
    cell: Element,
    sharedStrings: string[],
    percentStyleIds: Set<number>,
    dateStyleIds: Set<number>
  ): unknown {
    const type = cell.getAttribute('t');
    const value = cell.querySelector('v')?.textContent ?? '';
    const styleIndex = Number(cell.getAttribute('s'));
    const isPercentStyle = Number.isFinite(styleIndex) && percentStyleIds.has(styleIndex);
    const isDateStyle = Number.isFinite(styleIndex) && dateStyleIds.has(styleIndex);
    if (type === 's') {
      if (isDateStyle) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : value;
      }
      const index = Number(value);
      if (Number.isFinite(index) && index >= 0 && index < sharedStrings.length) {
        return sharedStrings[index] ?? '';
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : '';
    }
    if (type === 'inlineStr') {
      return cell.querySelector('is t')?.textContent ?? '';
    }
    if (type === 'b') {
      return value === '1';
    }
    if (type === 'str') {
      return value;
    }
    if (type === 'd') {
      return value;
    }
    if (value === '') {
      return null;
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return value;
    }
    return isPercentStyle ? numeric * 100 : numeric;
  }

  private extractRowsFromTable(
    ref: string,
    columns: string[],
    cellMap: Map<string, unknown>,
    workbookDate1904: boolean,
    invalidDates: string[],
    tableName: string
  ): Array<Record<string, unknown>> {
    if (!ref) {
      return [];
    }

    const { startCol, startRow, endCol, endRow } = parseTableRef(ref);
    const rowStart = startRow + 1;
    const maxColumns = Math.max(columns.length, endCol - startCol + 1);
    const rows: Array<Record<string, unknown>> = [];

    for (let rowIndex = rowStart; rowIndex <= endRow; rowIndex += 1) {
      const rowObject: Record<string, unknown> = {};
      let hasAnyValue = false;

      for (let offset = 0; offset < maxColumns; offset += 1) {
        const columnIndex = startCol + offset;
        const header = columns[offset] ?? columnIndexToName(columnIndex);
        const cellRef = `${columnIndexToName(columnIndex)}${rowIndex}`;
        const rawValue = cellMap.get(cellRef);
        let value = rawValue;
        if (value === undefined) {
          value = null;
        }
        if (header && /FECHA|DATE|INICIO|FIN/i.test(header)) {
          value = this.normalizeDateValue(value, workbookDate1904);
          if (value === null && cellMap.get(cellRef) !== null && cellMap.get(cellRef) !== undefined && cellMap.get(cellRef) !== '') {
            invalidDates.push(`${tableName}.${header}: ${String(cellMap.get(cellRef))}`);
          }
        }
        rowObject[header || cellRef] = value;
        if (value !== null && value !== '') {
          hasAnyValue = true;
        }
      }

      if (hasAnyValue) {
        rows.push(rowObject);
      }
    }

    return rows;
  }

  private normalizeDateValue(value: unknown, workbookDate1904: boolean): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return excelSerialToDate(value, workbookDate1904).toISOString();
    }

    const text = String(value).trim();
    if (!text) {
      return null;
    }
    if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
      const serial = Number(text);
      return Number.isFinite(serial) ? excelSerialToDate(serial, workbookDate1904).toISOString() : null;
    }
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]) - 1;
      const day = Number(isoMatch[3]);
      const date = new Date(Date.UTC(year, month, day));
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    const parsed = parseExcelDate(text, workbookDate1904);
    return parsed ? parsed.toISOString() : null;
  }

  private buildValidationReport(
    fileName: string,
    sheetNames: string[],
    detectedTables: DetectedTableInfo[],
    tables: WorkbookTableData[],
    invalidDates: string[]
  ): WorkbookValidationReport {
    const findings: TableValidationFinding[] = this.mapping.expectations.map((expectation) => {
      const match = detectedTables.find(
        (table) => expectation.aliases.includes(table.name) || expectation.aliases.includes(table.displayName)
      );
      const detectedColumns = match?.columns ?? [];
      const missingColumns = expectation.expectedColumns.filter(
        (column) =>
          !detectedColumns.some((found) => this.normalization.normalizeHeader(found) === this.normalization.normalizeHeader(column))
      );
      const severity: ValidationSeverity = !match && expectation.critical ? 'error' : missingColumns.length ? 'warning' : 'info';

      return {
        key: expectation.key,
        name: expectation.primaryName,
        sheetName: match?.sheetName ?? null,
        found: Boolean(match),
        critical: expectation.critical,
        rowCount: match?.rowCount ?? null,
        detectedColumns,
        missingColumns,
        severity,
        notes: !match
          ? [expectation.critical ? 'Tabla critica ausente' : 'Tabla opcional ausente']
          : missingColumns.length
            ? ['Hay columnas faltantes respecto del mapeo esperado']
            : ['Tabla encontrada y compatible con el mapeo base']
      };
    });

    const invalidNumbers: string[] = [];
    const currencyCounter = new Map<string, number>();
    const uncategorizedSymbols: string[] = [];
    const symbolsWithoutHistory: string[] = [];
    const symbolsWithoutCurrentPrice: string[] = [];

    const operations = this.findTable(tables, ['Tabla6']);
    const positions = this.findTable(tables, ['TablaPosiciones']);
    const history = this.findTable(tables, ['Tabla5']);
    const classification = this.findTable(tables, ['Tabla47']);
    const manualAlerts = this.findTable(tables, ['ObjetivosPorEspecie']);

    const historySymbols = new Set(
      history?.rows
        .map((row) => String(this.normalization.pickValue(row, ['ESPECIE', 'Especie']) ?? '').toUpperCase())
        .filter(Boolean)
    );
    const classifiedSymbols = new Set(
      classification?.rows.map((row) => String(this.normalization.pickValue(row, ['ESPECIE']) ?? '').toUpperCase()).filter(Boolean)
    );
    const positionSymbols = new Set(
      positions?.rows.map((row) => String(this.normalization.pickValue(row, ['ESPECIE']) ?? '').toUpperCase()).filter(Boolean)
    );

    for (const row of operations?.rows ?? []) {
      const total = this.normalization.pickValue(row, ['TOTAL']);
      if (total !== null && total !== undefined && this.normalization.asNumber(total) === null) {
        invalidNumbers.push(`Tabla6 TOTAL: ${String(total)}`);
      }
      const currency = this.normalization.normalizeCurrencyOrUnknown(this.normalization.pickValue(row, ['MONEDA']));
      if (currency === 'UNKNOWN') {
        const raw = String(this.normalization.pickValue(row, ['MONEDA']) ?? '').trim().toUpperCase() || 'UNKNOWN';
        currencyCounter.set(raw, (currencyCounter.get(raw) ?? 0) + 1);
      }
      const symbol = this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE']));
      if (symbol && !classifiedSymbols.has(symbol)) {
        uncategorizedSymbols.push(symbol);
      }
    }

    for (const symbol of positionSymbols) {
      if (!historySymbols.has(symbol)) {
        symbolsWithoutHistory.push(symbol);
      }
    }

    for (const row of manualAlerts?.rows ?? []) {
      const symbol = this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE', 'Especie']));
      if (symbol && !positionSymbols.has(symbol)) {
        symbolsWithoutCurrentPrice.push(symbol);
      }
    }

    const errors = findings.filter((finding) => finding.severity === 'error').map((finding) => `${finding.name}: ${finding.notes.join(', ')}`);
    const warnings = findings.filter((finding) => finding.severity === 'warning').map((finding) => `${finding.name}: ${finding.notes.join(', ')}`);

    return {
      fileName,
      sheetNames,
      detectedTables,
      findings,
      errors,
      warnings,
      invalidDates: this.unique(invalidDates),
      invalidNumbers,
      currencyIssues: Array.from(currencyCounter.entries()).map(([currency, count]) => ({ currency, count })),
      uncategorizedSymbols: this.unique(uncategorizedSymbols),
      symbolsWithoutHistory: this.unique(symbolsWithoutHistory),
      symbolsWithoutCurrentPrice: this.unique(symbolsWithoutCurrentPrice)
    };
  }

  private findTable(tables: WorkbookTableData[], aliases: string[]): WorkbookTableData | null {
    const normalized = aliases.map((alias) => this.normalization.normalizeHeader(alias));
    return (
      tables.find(
        (table) => normalized.includes(this.normalization.normalizeHeader(table.name)) || normalized.includes(this.normalization.normalizeHeader(table.displayName))
      ) ?? null
    );
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
  }
}
