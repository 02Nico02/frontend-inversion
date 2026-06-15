import { Injectable } from '@angular/core';
import {
  AssetClassification,
  HistoricalPrice,
  InvestmentOperation,
  PortfolioPosition
} from '../../../core/models/portfolio.models';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';
import { ChartDataService, SeriesPoint } from '../../../core/services/chart-data.service';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { PortfolioCalculatorService } from '../../../core/services/portfolio-calculator.service';
import { parseExcelDate } from '../../../core/utils/value-parsing.utils';

export interface AssetSummaryMetrics {
  totalCurrentValue: number;
  totalInvested: number;
  resultAmount: number;
  resultPercent: number | null;
  quantity: number;
  averagePrice: number | null;
  currentPrice: number | null;
  weightPercent: number;
  currencyTotal: number;
  expectedAmount: number | null;
  expectedDelta: number | null;
  expectedDeviation: number | null;
}

export interface AssetOperationMetrics {
  count: number;
  totalQuantity: number;
  totalInvested: number;
  totalCurrent: number;
  resultAmount: number;
  resultPercent: number | null;
  weightedAveragePrice: number;
  bestLot: InvestmentOperation | null;
  worstLot: InvestmentOperation | null;
}

export interface AssetHistoryStats {
  initial: number;
  final: number;
  variationAmount: number;
  variationPercent: number | null;
  latest: number;
  latestDate: string | null;
  latestChangeAmount: number | null;
  latestChangePercent: number | null;
  startDate: string | null;
  endDate: string | null;
  max: number;
  maxDate: string | null;
  min: number;
  minDate: string | null;
  count: number;
}

export interface AssetClassificationReview {
  exists: boolean;
  type: string;
  sector: string;
  subsector: string;
  region: string;
  positionType: string;
  currency: string;
  missing: string;
  source: string;
  match: string;
  hint: string;
}

export interface AssetDetailViewModel {
  symbol: string;
  position: PortfolioPosition;
  classification: AssetClassification | null;
  operations: InvestmentOperation[];
  manualAlerts: CombinedAlert[];
  calculatedAlerts: CombinedAlert[];
  signalAlerts: CombinedAlert[];
  historicalPrices: HistoricalPrice[];
  historicalSeries: SeriesPoint[];
  summaryMetrics: AssetSummaryMetrics;
  operationMetrics: AssetOperationMetrics;
  historyStats: AssetHistoryStats | null;
  classificationReview: AssetClassificationReview;
  headerSummary: string;
}

@Injectable({ providedIn: 'root' })
export class AssetDetailService {
  constructor(
    private readonly calculator: PortfolioCalculatorService,
    private readonly chartData: ChartDataService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  buildViewModel(snapshot: PortfolioAppState, symbol: string): AssetDetailViewModel | null {
    const normalized = symbol.toUpperCase();
    const positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    const position = positions.find((item) => item.symbol.toUpperCase() === normalized);
    if (!position) {
      return null;
    }
    const classification = this.classificationFor(position, snapshot.dataset?.classifications ?? []);
    const operations = this.operationsFor(snapshot.dataset?.operations ?? [], normalized);
    const historicalPrices = this.historicalFor(snapshot.dataset?.historicalPrices ?? [], normalized);
    const manualAlerts = (snapshot.combinedAlerts ?? []).filter((alert) => alert.group === 'manual' && alert.symbol.toUpperCase() === normalized);
    const calculatedAlerts = (snapshot.combinedAlerts ?? []).filter((alert) => alert.group === 'calculated' && alert.symbol.toUpperCase() === normalized);
    const signalAlerts = (snapshot.combinedAlerts ?? []).filter((alert) => alert.group === 'signal' && alert.symbol.toUpperCase() === normalized);
    const currentPrice = position.currentPrice ?? historicalPrices.at(-1)?.price ?? null;
    const totalCurrentValue = position.currentValue;
    const totalInvested = position.totalInvested;
    const resultAmount = totalCurrentValue - totalInvested;
    const resultPercent = totalInvested > 0 ? (resultAmount / totalInvested) * 100 : null;
    const totalQuantity = position.quantity;
    const averagePrice = position.averagePrice ?? (totalQuantity > 0 ? totalInvested / totalQuantity : null);
    const currencyTotal = positions
      .filter((item) => this.currencyMapper.normalizeCurrency(item.currency) === this.currencyMapper.normalizeCurrency(position.currency))
      .reduce((sum, item) => sum + item.currentValue, 0);
    const weightPercent = currencyTotal > 0 ? (position.currentValue / currencyTotal) * 100 : 0;
    const expected = classification?.expected ?? null;
    const expectedAmount = expected === null || expected === undefined || expected === 0 ? null : expected;
    const expectedDelta = expectedAmount !== null ? totalCurrentValue - expectedAmount : null;
    const expectedDeviation = expectedAmount && expectedAmount !== 0 ? (expectedDelta! / expectedAmount) * 100 : null;
    const headerSummary = [
      classification?.type || position.positionType || 'Sin tipo',
      classification?.sector || position.sector || 'Sin sector',
      classification?.subsector || position.subsector || 'Sin subsector',
      classification?.region || position.region || 'Sin región'
    ].join(' · ');

    return {
      symbol: position.symbol,
      position: {
        ...position,
        currentPrice
      },
      classification,
      operations,
      manualAlerts,
      calculatedAlerts,
      signalAlerts,
      historicalPrices,
      historicalSeries: this.chartData.priceSeries(historicalPrices, position.symbol),
      summaryMetrics: {
        totalCurrentValue,
        totalInvested,
        resultAmount,
        resultPercent,
        quantity: totalQuantity,
        averagePrice,
        currentPrice,
        weightPercent,
        currencyTotal,
        expectedAmount,
        expectedDelta,
        expectedDeviation
      },
      operationMetrics: this.operationMetrics(operations, position),
      historyStats: this.historyStats(historicalPrices),
      classificationReview: this.classificationReview(position, classification),
      headerSummary
    };
  }

  filterHistory(values: HistoricalPrice[], period: 'ALL' | '1M' | '3M' | '6M' | 'YTD' | '1Y'): HistoricalPrice[] {
    const ordered = [...values].sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
    const lastDate = this.lastDate(ordered);
    if (!lastDate || period === 'ALL') {
      return ordered;
    }
    const start = new Date(lastDate);
    switch (period) {
      case '1M':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3M':
        start.setMonth(start.getMonth() - 3);
        break;
      case '6M':
        start.setMonth(start.getMonth() - 6);
        break;
      case 'YTD':
        return ordered.filter((item) => this.dateValue(item.date) >= new Date(lastDate.getFullYear(), 0, 1).getTime());
      case '1Y':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    return ordered.filter((item) => {
      const value = this.dateValue(item.date);
      return value >= start.getTime() && value <= lastDate.getTime();
    });
  }

  seriesForHistory(values: HistoricalPrice[], symbol: string): SeriesPoint[] {
    return this.chartData.priceSeries(values.filter((item) => item.price !== null), symbol);
  }

  formatMoney(value: number | null | undefined, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
  }

  formatPercent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  formatNumber(value: number | null | undefined): string {
    return this.currencyMapper.formatNumber(value);
  }

  currencyLabel(currency: string): string {
    return this.currencyMapper.getCurrencyLabel(currency);
  }

  classificationHelp(review: AssetClassificationReview): string {
    if (review.missing === 'Sin faltantes') {
      return 'Clasificación completa.';
    }
    return review.hint;
  }

  private classificationFor(position: PortfolioPosition, classifications: AssetClassification[]): AssetClassification | null {
    const symbol = position.symbol.toUpperCase();
    return classifications.find((item) => item.symbol.toUpperCase() === symbol) ?? position.classification ?? null;
  }

  private operationMetrics(operations: InvestmentOperation[], position: PortfolioPosition): AssetOperationMetrics {
    const count = operations.length;
    const totalQuantity = operations.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const totalInvested = operations.reduce((sum, item) => sum + (item.total ?? item.amount ?? 0), 0);
    const totalCurrent = operations.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
    const resultAmount = totalCurrent - totalInvested;
    const resultPercent = totalInvested > 0 ? (resultAmount / totalInvested) * 100 : null;
    const weightedAveragePrice = totalQuantity > 0 ? totalInvested / totalQuantity : 0;
    const ranked = [...operations].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
    const bestLot = ranked[0] ?? null;
    const worstLot = ranked.at(-1) ?? null;
    return {
      count,
      totalQuantity,
      totalInvested,
      totalCurrent,
      resultAmount,
      resultPercent,
      weightedAveragePrice,
      bestLot,
      worstLot
    };
  }

  historyStats(values: HistoricalPrice[]): AssetHistoryStats | null {
    const ordered = this.orderedHistory(values);
    if (!ordered.length) {
      return null;
    }
    const first = ordered[0];
    const last = ordered.at(-1) ?? first;
    const numbers = ordered.map((item) => Number(item.price ?? 0));
    const initial = Number(first.price ?? 0);
    const final = Number(last.price ?? 0);
    const variationAmount = final - initial;
    const max = Math.max(...numbers);
    const min = Math.min(...numbers);
    const latest = final;
    const previous = ordered.length > 1 ? Number(ordered[ordered.length - 2].price ?? 0) : null;
    return {
      initial,
      final,
      variationAmount,
      variationPercent: initial > 0 ? (variationAmount / initial) * 100 : null,
      latest,
      latestDate: this.formatDate(last.date),
      latestChangeAmount: previous !== null ? latest - previous : null,
      latestChangePercent: previous && previous !== 0 ? ((latest - previous) / previous) * 100 : null,
      startDate: this.formatDate(first.date),
      endDate: this.formatDate(last.date),
      max,
      maxDate: this.formatDate(ordered.find((item) => Number(item.price ?? 0) === max)?.date),
      min,
      minDate: this.formatDate(ordered.find((item) => Number(item.price ?? 0) === min)?.date),
      count: ordered.length
    };
  }

  private classificationReview(position: PortfolioPosition, classification: AssetClassification | null): AssetClassificationReview {
    const missing = [
      !classification?.type ? 'tipo activo' : null,
      !classification?.sector ? 'sector' : null,
      !classification?.subsector ? 'subsector' : null,
      !classification?.region ? 'región' : null
    ].filter(Boolean);
    const missingText = missing.length ? missing.join(', ') : 'Sin faltantes';
    const hint = missingText === 'Sin faltantes'
      ? 'Clasificación completa.'
      : [
          missing.includes('sector') ? 'Falta sector en Tabla47.' : null,
          missing.includes('subsector') ? 'Falta subsector en Tabla47.' : null,
          missing.includes('región') ? 'Falta región en Tabla47.' : null,
          missing.includes('tipo activo') ? 'Falta tipo activo en Tabla47.' : null
        ].filter(Boolean).join(' ');
    return {
      exists: Boolean(classification),
      type: classification?.type || 'Sin datos',
      sector: classification?.sector || 'Sin sector',
      subsector: classification?.subsector || 'Sin subsector',
      region: classification?.region || 'Sin región',
      positionType: position.positionType || 'Sin datos',
      currency: this.currencyLabel(position.currency),
      missing: missingText,
      source: 'Tabla47',
      match: 'Normalizado por especie',
      hint
    };
  }

  private historicalFor(values: HistoricalPrice[], symbol: string): HistoricalPrice[] {
    return [...values]
      .filter((item) => item.symbol.toUpperCase() === symbol && item.price !== null && item.price !== undefined)
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
  }

  private orderedHistory(values: HistoricalPrice[]): HistoricalPrice[] {
    return [...values]
      .filter((item) => item.price !== null && item.price !== undefined)
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
  }

  private operationsFor(operations: InvestmentOperation[], symbol: string): InvestmentOperation[] {
    return [...operations]
      .filter((operation) => operation.symbol.toUpperCase() === symbol && (operation.total !== null || operation.amount !== null))
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
  }

  private formatDate(value: string | Date | null | undefined): string {
    if (!value) {
      return 'N/D';
    }
    const date = parseExcelDate(value);
    if (!date) {
      return 'N/D';
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  private dateValue(value: string | Date | null | undefined): number {
    if (!value) {
      return 0;
    }
    const date = parseExcelDate(value);
    return date ? date.getTime() : 0;
  }

  private lastDate(series: HistoricalPrice[]): Date | null {
    const last = series.at(-1)?.date ?? null;
    return parseExcelDate(last);
  }
}
