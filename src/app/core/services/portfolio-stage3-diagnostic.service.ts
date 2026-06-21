import { Injectable } from '@angular/core';
import { EffectivePortfolioPosition, PositionEffectiveMetricsService } from './position-effective-metrics.service';
import { PortfolioMinimumBalanceTrendService } from './portfolio-minimum-balance-trend.service';
import { PortfolioAppState } from './portfolio-state.service';
import { WorkbookTableData } from '../models/workbook.models';
import { parseExcelDate } from '../utils/value-parsing.utils';

export interface Stage3DiagnosticReport {
  generatedAt: string;
  dateEvaluated: string;
  summary: {
    balanceActualVsMinimum: {
      comparableValueARS: number | null;
      minimumExpectedARS: number | null;
      balanceVsMinimumARS: number | null;
      balanceVsMinimumPercent: number | null;
      benchmarkSource: string | null;
    };
    balanceHistoricalVsMinimum: {
      comparableValueARS: number | null;
      minimumExpectedARS: number | null;
      balanceVsMinimumARS: number | null;
      balanceVsMinimumPercent: number | null;
      benchmarkSource: string | null;
    };
    difference: {
      comparableValueARS: number | null;
      minimumExpectedARS: number | null;
      balanceVsMinimumARS: number | null;
      balanceVsMinimumPercentPoints: number | null;
    };
    benchmarkSourcesAvailable: string[];
    includedLots: number;
    skippedLots: number;
    warnings: string[];
  };
  currentPositions: Array<Record<string, unknown>>;
  historicalLots: Array<Record<string, unknown>>;
  fci: Array<Record<string, unknown>>;
  caucions: Array<Record<string, unknown>>;
  crossedPurchasesSales: Array<Record<string, unknown>>;
  tables: {
    hasTabla11: boolean;
    hasTabla5: boolean;
    hasTabla6: boolean;
    hasTabla13: boolean;
    hasTablaCalendario: boolean;
    hasTablaCalendarioRem: boolean;
    hasTablaCalendarioInf: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class PortfolioStage3DiagnosticService {
  constructor(
    private readonly trend: PortfolioMinimumBalanceTrendService,
    private readonly effectiveMetrics: PositionEffectiveMetricsService
  ) {}

  buildReport(snapshot: PortfolioAppState, dateInput: string = '2026-06-19'): Stage3DiagnosticReport {
    const currentComparison = this.trend.debugMinimumBalanceTrendCurrentComparison(snapshot);
    const historical = this.trend.debugMinimumBalanceTrendForDate(snapshot, dateInput);
    const trendReport = this.trend.buildTrend(snapshot);
    const effectivePositions = snapshot.dataset ? this.effectiveMetrics.buildEffectivePositions(snapshot) : [];
    const currentPositions = effectivePositions.map((item) => this.serializeEffectivePosition(item));
    const tables = snapshot.workbook?.tables ?? [];

    return {
      generatedAt: new Date().toISOString(),
      dateEvaluated: historical.date,
      summary: {
        balanceActualVsMinimum: {
          comparableValueARS: currentComparison.current.comparableValueARS,
          minimumExpectedARS: currentComparison.current.minimumExpectedARS,
          balanceVsMinimumARS: currentComparison.current.balanceVsMinimumARS,
          balanceVsMinimumPercent: currentComparison.current.balanceVsMinimumPercent,
          benchmarkSource: currentComparison.benchmarkSourceActual ?? null
        },
        balanceHistoricalVsMinimum: {
          comparableValueARS: historical.totals.comparableValueARS,
          minimumExpectedARS: historical.totals.minimumExpectedARS,
          balanceVsMinimumARS: historical.totals.balanceVsMinimumARS,
          balanceVsMinimumPercent: historical.totals.balanceVsMinimumPercent,
          benchmarkSource: historical.benchmarkSourceSelected ?? null
        },
        difference: {
          comparableValueARS: this.diff(currentComparison.current.comparableValueARS, historical.totals.comparableValueARS),
          minimumExpectedARS: this.diff(currentComparison.current.minimumExpectedARS, historical.totals.minimumExpectedARS),
          balanceVsMinimumARS: this.diff(currentComparison.current.balanceVsMinimumARS, historical.totals.balanceVsMinimumARS),
          balanceVsMinimumPercentPoints: this.diff(
            currentComparison.current.balanceVsMinimumPercent,
            historical.totals.balanceVsMinimumPercent
          )
        },
        benchmarkSourcesAvailable: historical.benchmarkSourcesAvailable,
        includedLots: historical.totals.includedLots,
        skippedLots: historical.totals.skippedLots,
        warnings: Array.from(
          new Set([
            ...currentComparison.warnings,
            ...historical.warnings,
            ...(currentComparison.benchmarkSourceActual !== currentComparison.benchmarkSourceHistorical
              ? ['El histórico usa una fuente de benchmark distinta al cálculo actual.']
              : [])
          ])
        )
      },
      currentPositions,
      historicalLots: historical.lots.map((lot) => ({ ...lot })),
      fci: this.buildFciDiagnostics(snapshot, dateInput),
      caucions: this.buildCaucionDiagnostics(snapshot, dateInput),
      crossedPurchasesSales: this.buildCrossedMovementsDiagnostics(snapshot),
      tables: {
        hasTabla11: this.hasTable(tables, ['Tabla11']),
        hasTabla5: this.hasTable(tables, ['Tabla5']),
        hasTabla6: this.hasTable(tables, ['Tabla6']),
        hasTabla13: this.hasTable(tables, ['Tabla13']),
        hasTablaCalendario: this.hasTable(tables, ['TablaCalendario']),
        hasTablaCalendarioRem: this.hasTable(tables, ['TablaCalendarioRem']),
        hasTablaCalendarioInf: this.hasTable(tables, ['TablaCalendarioInf'])
      }
    };
  }

  toMarkdown(report: Stage3DiagnosticReport): string {
    const lines: string[] = [];
    lines.push('# Diagnóstico Etapa 3');
    lines.push('');
    lines.push(`- Generado: ${report.generatedAt}`);
    lines.push(`- Fecha evaluada: ${report.dateEvaluated}`);
    lines.push(`- Tablas: ${JSON.stringify(report.tables)}`);
    lines.push('');
    lines.push('## Resumen');
    lines.push('');
    lines.push(`- Balance actual vs mínimo: ${JSON.stringify(report.summary.balanceActualVsMinimum)}`);
    lines.push(`- Balance histórico vs mínimo: ${JSON.stringify(report.summary.balanceHistoricalVsMinimum)}`);
    lines.push(`- Diferencia: ${JSON.stringify(report.summary.difference)}`);
    lines.push(`- Included lots: ${report.summary.includedLots}`);
    lines.push(`- Skipped lots: ${report.summary.skippedLots}`);
    if (report.summary.warnings.length) {
      lines.push('');
      lines.push('### Warnings');
      for (const warning of report.summary.warnings) {
        lines.push(`- ${warning}`);
      }
    }
    lines.push('');
    lines.push('## Posiciones actuales');
    lines.push(JSON.stringify(report.currentPositions, null, 2));
    lines.push('');
    lines.push('## Lotes historicos');
    lines.push(JSON.stringify(report.historicalLots, null, 2));
    lines.push('');
    lines.push('## FCI');
    lines.push(JSON.stringify(report.fci, null, 2));
    lines.push('');
    lines.push('## Cauciones');
    lines.push(JSON.stringify(report.caucions, null, 2));
    lines.push('');
    lines.push('## Compras y ventas cruzadas');
    lines.push(JSON.stringify(report.crossedPurchasesSales, null, 2));
    return lines.join('\n');
  }

  private serializeEffectivePosition(item: EffectivePortfolioPosition): Record<string, unknown> {
    return {
      symbol: item.symbol,
      currency: item.currency,
      positionType: item.position.positionType,
      assetType: item.position.assetType,
      quantity: item.position.quantity,
      investedAmount: item.position.totalInvested,
      currentValue: item.position.currentValue,
      comparableValue: item.minimumPerformance?.comparableValue ?? item.position.currentValue,
      minimumExpectedValue: item.minimumExpectedValue,
      minimumExpectedValueAdjusted: item.minimumPerformance?.minimumExpectedValueAdjusted ?? null,
      incomeAmount: item.minimumPerformance?.incomeAmount ?? 0,
      capitalReturnedAmount: item.minimumPerformance?.capitalReturnedAmount ?? 0,
      vsMinimumARS: item.minimumValueVsAmount,
      vsMinimumPercent: item.minimumValueVsPercent
    };
  }

  private buildFciDiagnostics(snapshot: PortfolioAppState, dateInput: string): Array<Record<string, unknown>> {
    const tables = snapshot.workbook?.tables ?? [];
    const fciSymbols = this.extractFciSymbols(tables);
    const date = this.asDate(dateInput);
    const currentBySymbol = new Map(
      (snapshot.dataset ? this.effectiveMetrics.buildEffectivePositions(snapshot) : []).map((item) => [item.symbol.toUpperCase(), item] as const)
    );
    const historicalPrices = this.indexHistoricalPrices(snapshot.dataset?.historicalPrices ?? []);
    const operationsBySymbol = this.groupBySymbol(snapshot.dataset?.operations ?? [], (item) => ({
      quantity: Number(item.quantity ?? 0),
      total: Number(item.total ?? item.amount ?? 0)
    }));
    const salesBySymbol = this.groupBySymbol(snapshot.dataset?.sales ?? [], (item) => ({
      quantity: Number(item.quantity ?? 0),
      total: Number(item.total ?? item.amount ?? 0),
      sellPrice: Number(item.sellPrice ?? item.buyPrice ?? 0)
    }));
    const tabla11 = this.findTable(tables, ['Tabla11']);

    const symbols = Array.from(fciSymbols).sort((left, right) => left.localeCompare(right, 'es'));
    return symbols.map((symbol) => {
      const priceInfo = date ? this.priceAtOrBefore(historicalPrices, symbol, date) : null;
      const currentPosition = currentBySymbol.get(symbol) ?? null;
      const opStats = operationsBySymbol.get(symbol) ?? { quantity: 0, total: 0 };
      const saleStats = salesBySymbol.get(symbol) ?? { quantity: 0, total: 0, sellPrice: 0 };
      const tabla11Rows = tabla11?.rows ?? [];
      const tabla11Row = tabla11Rows.find(
        (row) => String(this.pickRowValue(row, ['Fondos com. Inv.', 'Fondos com Inv']) ?? '').trim().toUpperCase() === symbol
      ) ?? null;
      const quantity = opStats.quantity || currentPosition?.position.quantity || 0;
      const directValue = priceInfo?.price ?? null;
      const multiplicativeValue = directValue !== null ? quantity * directValue : null;
      return {
        symbol,
        marketValueRule: 'tabla5-direct-value',
        apareceEnTabla11: Boolean(tabla11Row),
        apareceEnTabla5: this.hasSymbolInTable(tables, ['Tabla5'], symbol),
        apareceEnTabla6: this.hasSymbolInTable(tables, ['Tabla6'], symbol),
        apareceEnTabla13: this.hasSymbolInTable(tables, ['Tabla13'], symbol),
        positionType: currentPosition?.position.positionType ?? null,
        assetType: currentPosition?.position.assetType ?? null,
        tabla5PrecioEnFecha: directValue,
        tabla6Cantidad: opStats.quantity || null,
        tabla6Total: opStats.total || null,
        tabla13CantidadVendida: saleStats.quantity || null,
        tabla13PrecioVenta: saleStats.sellPrice || null,
        valorCalculadoActual: currentPosition?.position.currentValue ?? null,
        valorHistoricoSiUsaTabla5PrecioDirecto: directValue,
        valorHistoricoSiMultiplicaCantidadPorPrecio: multiplicativeValue,
        diferenciaEntreAmbos: directValue !== null && multiplicativeValue !== null ? multiplicativeValue - directValue : null,
        included: Boolean(currentPosition),
        skipReason: currentPosition ? null : 'missing-active-position-base'
      };
    });
  }

  private buildCaucionDiagnostics(snapshot: PortfolioAppState, dateInput: string): Array<Record<string, unknown>> {
    const tables = snapshot.workbook?.tables ?? [];
    const date = this.asDate(dateInput);
    const currentBySymbol = new Map(
      (snapshot.dataset ? this.effectiveMetrics.buildEffectivePositions(snapshot) : []).map((item) => [item.symbol.toUpperCase(), item] as const)
    );
    const symbols = new Set<string>();
    for (const table of tables) {
      for (const row of table.rows ?? []) {
        const symbol = String(this.pickRowValue(row, ['ESPECIE', 'Especie']) ?? '').trim().toUpperCase();
        if (this.isCaucionSymbol(symbol)) {
          symbols.add(symbol);
        }
      }
    }

    return Array.from(symbols)
      .sort((left, right) => left.localeCompare(right, 'es'))
      .map((symbol) => {
        const currentPosition = currentBySymbol.get(symbol) ?? null;
        const priceInfo = date ? this.priceAtOrBefore(this.indexHistoricalPrices(snapshot.dataset?.historicalPrices ?? []), symbol, date) : null;
        const quantity = this.sumTableQuantity(snapshot.workbook?.tables ?? [], ['Tabla6', 'Tabla13'], symbol);
        const sellPrice = this.findLatestSellPrice(snapshot.workbook?.tables ?? [], symbol);
        const buyDate = this.findTableDate(snapshot.workbook?.tables ?? [], ['Tabla6'], symbol, ['FECHA', 'Fecha', 'Fecha Com.']);
        const sellDate = this.findTableDate(snapshot.workbook?.tables ?? [], ['Tabla13'], symbol, ['FECHA', 'Fecha Vent.', 'Fecha Vent']);
        return {
          symbol,
          sourceTable: this.findSymbolSourceTable(snapshot.workbook?.tables ?? [], symbol),
          buyDate: this.debugDateKey(buyDate),
          sellDate: this.debugDateKey(sellDate),
          quantity,
          tabla5PrecioEnFecha: priceInfo?.price ?? null,
          tabla13PrecioVenta: sellPrice,
          marketValueRule: 'quantity-while-active',
          valorMientrasActiva: quantity ?? null,
          valorAlCierre: quantity !== null && sellPrice !== null ? quantity * sellPrice : null,
          estaActivaEnFechaEvaluada: Boolean(currentPosition),
          deberiaContarEnFechaEvaluada: Boolean(currentPosition),
          included: Boolean(currentPosition),
          skipReason: currentPosition ? null : 'missing-active-position-base'
        };
      });
  }

  private buildCrossedMovementsDiagnostics(snapshot: PortfolioAppState): Array<Record<string, unknown>> {
    const dataset = snapshot.dataset;
    if (!dataset) {
      return [];
    }

    const operationsBySymbol = new Map<string, number>();
    for (const operation of dataset.operations ?? []) {
      const symbol = String(operation.symbol ?? '').trim().toUpperCase();
      if (!symbol) {
        continue;
      }
      operationsBySymbol.set(symbol, (operationsBySymbol.get(symbol) ?? 0) + Math.max(0, Number(operation.quantity ?? 0)));
    }

    const salesBySymbol = new Map<string, number>();
    for (const sale of dataset.sales ?? []) {
      const symbol = String(sale.symbol ?? '').trim().toUpperCase();
      if (!symbol) {
        continue;
      }
      salesBySymbol.set(symbol, (salesBySymbol.get(symbol) ?? 0) + Math.max(0, Number(sale.quantity ?? 0)));
    }

    const symbols = new Set<string>([...operationsBySymbol.keys(), ...salesBySymbol.keys()]);
    return Array.from(symbols)
      .sort((left, right) => left.localeCompare(right, 'es'))
      .map((symbol) => {
        const buys = operationsBySymbol.get(symbol) ?? 0;
        const sells = salesBySymbol.get(symbol) ?? 0;
        return {
          symbol,
          totalCantidadCompradaTabla6: buys,
          totalCantidadVendidaTabla13: sells,
          cantidadRemanenteEstimada: buys - sells,
          cantidadActualTablaPosiciones: this.findCurrentQuantity(snapshot, symbol),
          diferencia: (buys - sells) - this.findCurrentQuantity(snapshot, symbol),
          ventasEnLaFechaEvaluada: sells,
          comprasEnLaFechaEvaluada: buys,
          hayCompraYVentaMismoDia: this.hasSameDayBuyAndSell(snapshot, symbol)
        };
      });
  }

  private findCurrentQuantity(snapshot: PortfolioAppState, symbol: string): number {
    const current = snapshot.dataset?.positions.find((item) => String(item.symbol ?? '').trim().toUpperCase() === symbol);
    return Number(current?.quantity ?? 0);
  }

  private hasSameDayBuyAndSell(snapshot: PortfolioAppState, symbol: string): boolean {
    const operations = (snapshot.dataset?.operations ?? []).filter((item) => String(item.symbol ?? '').trim().toUpperCase() === symbol);
    const sales = (snapshot.dataset?.sales ?? []).filter((item) => String(item.symbol ?? '').trim().toUpperCase() === symbol);
    const buyDates = new Set(operations.map((item) => this.asDate(item.date)?.toISOString().slice(0, 10)).filter((value): value is string => Boolean(value)));
    return sales.some((sale) => {
      const sellDate = this.asDate(sale.sellDate ?? sale.buyDate);
      return Boolean(sellDate && buyDates.has(sellDate.toISOString().slice(0, 10)));
    });
  }

  private extractFciSymbols(tables: WorkbookTableData[]): Set<string> {
    const symbols = new Set<string>();
    const table = this.findTable(tables, ['Tabla11']);
    if (table) {
      for (const row of table.rows ?? []) {
        const value = this.pickRowValue(row, ['Fondos com. Inv.', 'Fondos com Inv', 'Fondos com. Inv']);
        const symbol = String(value ?? '').trim().toUpperCase();
        if (symbol) {
          symbols.add(symbol);
        }
      }
    }

    for (const tableData of tables) {
      for (const row of tableData.rows ?? []) {
        const symbol = String(this.pickRowValue(row, ['ESPECIE']) ?? '').trim().toUpperCase();
        const positionType = String(this.pickRowValue(row, ['TIPO']) ?? '').toUpperCase();
        const assetType = String(this.pickRowValue(row, ['TIPO', 'CLASE', 'ACTIVO']) ?? '').toUpperCase();
        if (!symbol) {
          continue;
        }
        if (positionType.includes('VALORIZADO') || assetType.includes('FCI') || assetType.includes('MONEY MARKET')) {
          symbols.add(symbol);
        }
      }
    }

    return symbols;
  }

  private hasTable(tables: WorkbookTableData[], names: string[]): boolean {
    return Boolean(this.findTable(tables, names));
  }

  private hasSymbolInTable(tables: WorkbookTableData[], tableNames: string[], symbol: string): boolean {
    const table = this.findTable(tables, tableNames);
    if (!table) {
      return false;
    }
    return table.rows.some((row) => String(this.pickRowValue(row, ['ESPECIE', 'Especie']) ?? '').trim().toUpperCase() === symbol);
  }

  private findSymbolSourceTable(tables: WorkbookTableData[], symbol: string): string | null {
    for (const table of tables) {
      if (table.rows.some((row) => String(this.pickRowValue(row, ['ESPECIE', 'Especie']) ?? '').trim().toUpperCase() === symbol)) {
        return table.name;
      }
    }
    return null;
  }

  private findLatestSellPrice(tables: WorkbookTableData[], symbol: string): number | null {
    const table = this.findTable(tables, ['Tabla13']);
    if (!table) {
      return null;
    }
    for (let index = table.rows.length - 1; index >= 0; index -= 1) {
      const row = table.rows[index];
      if (String(this.pickRowValue(row, ['ESPECIE']) ?? '').trim().toUpperCase() !== symbol) {
        continue;
      }
      const value = this.asNumber(this.pickRowValue(row, ['PREC. EN V.', 'PREC. V.', 'PRECIO VENTA']));
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  private findTableDate(
    tables: WorkbookTableData[],
    tableNames: string[],
    symbol: string,
    headers: string[]
  ): Date | null {
    const table = this.findTable(tables, tableNames);
    if (!table) {
      return null;
    }

    for (const row of table.rows) {
      if (String(this.pickRowValue(row, ['ESPECIE', 'Especie']) ?? '').trim().toUpperCase() !== symbol) {
        continue;
      }
      const dateValue = this.pickRowValue(row, headers);
      const date = this.asDate(dateValue as Date | string | null | undefined);
      if (date) {
        return date;
      }
    }

    return null;
  }

  private debugDateKey(value: Date | string | null | undefined): string | null {
    const date = this.asDate(value);
    return date ? date.toISOString().slice(0, 10) : null;
  }

  private sumTableQuantity(tables: WorkbookTableData[], tableNames: string[], symbol: string): number | null {
    let total = 0;
    let found = false;
    for (const tableName of tableNames) {
      const table = this.findTable(tables, [tableName]);
      if (!table) {
        continue;
      }
      for (const row of table.rows) {
        if (String(this.pickRowValue(row, ['ESPECIE', 'Especie']) ?? '').trim().toUpperCase() !== symbol) {
          continue;
        }
        const quantity = this.asNumber(this.pickRowValue(row, ['CANT.', 'CANTIDAD']));
        if (quantity !== null) {
          total += quantity;
          found = true;
        }
      }
    }
    return found ? total : null;
  }

  private findTable(tables: WorkbookTableData[], names: string[]): WorkbookTableData | null {
    const normalizedNames = names.map((name) => this.normalizeKey(name));
    return (
      tables.find((table) =>
        normalizedNames.includes(this.normalizeKey(table.name)) || normalizedNames.includes(this.normalizeKey(table.displayName))
      ) ?? null
    );
  }

  private groupBySymbol<T, R>(items: T[], project: (item: T) => R & { quantity: number; total: number; sellPrice?: number }): Map<string, R & { quantity: number; total: number; sellPrice?: number }> {
    const grouped = new Map<string, R & { quantity: number; total: number; sellPrice?: number }>();
    for (const item of items) {
      const symbol = String((item as { symbol?: string }).symbol ?? '').trim().toUpperCase();
      if (!symbol) {
        continue;
      }
      const current = grouped.get(symbol) ?? ({ quantity: 0, total: 0, sellPrice: undefined } as R & { quantity: number; total: number; sellPrice?: number });
      const projected = project(item);
      current.quantity += projected.quantity ?? 0;
      current.total += projected.total ?? 0;
      if (typeof projected.sellPrice === 'number') {
        current.sellPrice = projected.sellPrice;
      }
      grouped.set(symbol, current);
    }
    return grouped;
  }

  private priceAtOrBefore(priceIndex: Map<string, Array<{ date: Date; price: number }>>, symbol: string, date: Date): { price: number | null; date: Date | null } {
    const prices = priceIndex.get(symbol) ?? [];
    let candidate: { date: Date; price: number } | null = null;
    for (const price of prices) {
      if (price.date.getTime() <= date.getTime()) {
        candidate = price;
        continue;
      }
      break;
    }
    return candidate ? { price: candidate.price, date: candidate.date } : { price: null, date: null };
  }

  private indexHistoricalPrices(prices: Array<{ date: string | Date | null; symbol: string; price: number | null }>): Map<string, Array<{ date: Date; price: number }>> {
    const bucket = new Map<string, Array<{ date: Date; price: number }>>();
    for (const price of prices) {
      const symbol = String(price.symbol ?? '').trim().toUpperCase();
      const date = this.asDate(price.date);
      const numeric = this.asNumber(price.price);
      if (!symbol || !date || numeric === null) {
        continue;
      }
      const list = bucket.get(symbol) ?? [];
      list.push({ date, price: numeric });
      bucket.set(symbol, list);
    }
    for (const list of bucket.values()) {
      list.sort((left, right) => left.date.getTime() - right.date.getTime());
    }
    return bucket;
  }

  private pickRowValue(row: Record<string, unknown>, headers: string[]): unknown {
    const normalizedHeaders = headers.map((header) => this.normalizeKey(header));
    for (const [key, value] of Object.entries(row)) {
      if (normalizedHeaders.includes(this.normalizeKey(key))) {
        return value;
      }
    }
    return null;
  }

  private normalizeKey(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  }

  private isCaucionSymbol(symbol: string): boolean {
    const normalized = symbol.trim().toUpperCase();
    return normalized.startsWith('CAUCION') || normalized.startsWith('CAUCIÓN');
  }

  private asDate(value: Date | string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : parseExcelDate(value);
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  private asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const text = String(value).trim();
    if (!text) {
      return null;
    }
    const cleaned = text.replace(/\$/g, '').replace(/\s+/g, '').replace(/[^0-9.,-]/g, '');
    if (!cleaned) {
      return null;
    }
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      const normalized = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (hasComma && !hasDot) {
      const parsed = Number(cleaned.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private diff(left: number | null, right: number | null): number | null {
    if (left === null || right === null) {
      return null;
    }
    return left - right;
  }
}
