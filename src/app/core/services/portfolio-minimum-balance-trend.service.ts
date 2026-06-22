import { Injectable } from '@angular/core';
import { CanonicalCurrency } from './currency-mapper.service';
import { MinimumPerformanceService } from './minimum-performance.service';
import { PortfolioAppState } from './portfolio-state.service';
import {
  MinimumBalanceTrendPoint,
  MinimumBalanceTrendStatus,
  MinimumBalanceTrendSummary
} from '../models/portfolio-minimum-balance-trend.model';
import {
  AssetClassification,
  CalendarBenchmarkRow,
  HistoricalPrice,
  InvestmentMovement,
  InvestmentOperation,
  InvestmentSale,
  MonthlyInvestmentSummary,
  PortfolioPosition
} from '../models/portfolio.models';
import { WorkbookTableData } from '../models/workbook.models';
import { parseExcelDate } from '../utils/value-parsing.utils';
import type { SeriesPoint } from './chart-data.service';

interface HistoricalLot {
  id: string;
  symbol: string;
  currency: CanonicalCurrency | 'UNKNOWN';
  positionType: string | null;
  assetType: string | null;
  buyDate: Date | null;
  sellDate: Date | null;
  quantity: number | null;
  investedAmount: number | null;
  sourceTable: 'Tabla6' | 'Tabla13';
  instrumentKind: 'standard' | 'fci' | 'caucion';
  fciSource: 'Tabla11' | 'heuristic' | null;
}

interface HistoricalLotMovementTotals {
  incomeAmount: number;
  capitalReturnedAmount: number;
  amortizations: Array<{ date: Date; amount: number }>;
  appliedMovements: Array<{
    date: Date;
    type: string;
    amount: number;
    affectsPerformance: boolean;
    affectsInvestedCapital: boolean;
    capitalEffect: 'reduces-cost' | 'none' | 'unknown';
    assignedAmount: number;
    note: string | null;
  }>;
}

interface HistoricalLotContribution {
  marketValueRule: 'standard' | 'fci-direct-value' | 'caucion-quantity';
  historicalPrice: number | null;
  historicalPriceDate: Date | null;
  marketValue: number | null;
  benchmarkSource: string | null;
  buyBenchmarkSource: string | null;
  evalBenchmarkSource: string | null;
  buyIndex: number | null;
  buyIndexDate: Date | null;
  evalIndex: number | null;
  evalIndexDate: Date | null;
  benchmarkRatio: number | null;
  rawMinimumExpected: number | null;
  adjustedMinimumExpected: number | null;
  minimumExpectedUsed: number | null;
  incomeAmount: number;
  capitalReturnedAmount: number;
  comparableValue: number | null;
  balanceVsMinimum: number | null;
  balanceVsMinimumPercent: number | null;
  impactScore: number;
  movements: HistoricalLotMovementTotals['appliedMovements'];
  fciCapitalReturnedAmount?: number | null;
  capitalOriginalReconstruido?: number | null;
  capitalExpuestoCosto?: number | null;
  ventasOriginalCostTotales?: number | null;
  ventasOriginalCostHastaFecha?: number | null;
  ventasProceedsHastaFecha?: number | null;
  realizedGainHastaFecha?: number | null;
  benchmarkStartDate?: Date | null;
  benchmarkEndDate?: Date | null;
  baseCapitalUsed: number | null;
  baseCapitalRule: string | null;
  baseCapitalSource: string | null;
  baseCapitalPurchaseAmount: number | null;
  baseCapitalSoldAmount: number | null;
  baseCapitalNetAmount: number | null;
  baseDate: Date | null;
  possibleBaseMismatch: boolean;
  skipped: boolean;
  skipReason: string | null;
  fciSegmentStartDate: Date | null;
  fciSegmentBaseCapital: number | null;
  fciSegmentResetReason: string | null;
  fciSegmentThreshold: number | null;
  fciCapitalEvents?: FciCapitalEvent[];
}

interface FciCapitalEvent {
  date: Date;
  type: 'buy' | 'sell';
  amount: number;
  originalCostAmount: number;
  saleProceedsAmount: number | null;
  realizedGainAmount: number | null;
  sourceTable: 'Tabla6' | 'Tabla13';
  sourceId: string;
  benchmarkIndexBeforeEvent: number | null;
  benchmarkIndexAtEvent: number | null;
  capitalBeforeEvent: number;
  capitalAfterEvent: number;
  benchmarkBalanceBeforeEvent: number;
  benchmarkBalanceAfterEvent: number;
  minimumAccruedBeforeEvent: number;
  minimumAccruedAfterEvent: number;
  soldShare?: number | null;
  minimumExpectedRemoved?: number | null;
}

interface FciHistoricalSegmentContext {
  symbol: string;
  baseDate: Date | null;
  baseCapital: number | null;
  resetReason: string | null;
  threshold: number | null;
  marketValue: number | null;
  marketValueDate: Date | null;
}

const FCI_EXPOSURE_RESET_THRESHOLD = 0.25;

interface FciCapitalBaseInfo {
  purchaseAmount: number;
  soldAmount: number;
  netAmount: number;
  baseDate: Date | null;
  purchaseLotIds: string[];
  soldLotIds: string[];
  capitalEvents: FciCapitalEvent[];
}

interface HistoricalPointBuildResult {
  points: MinimumBalanceTrendPoint[];
  warnings: string[];
  benchmarkSourceSelected: CalendarBenchmarkRow['source'] | null;
  benchmarkSourcesAvailable: CalendarBenchmarkRow['source'][];
}

export interface MinimumBalanceTrendLotMovementDebug {
  date: string;
  type: string;
  amount: number;
  affectsPerformance: boolean;
  affectsInvestedCapital: boolean;
  capitalEffect: 'reduces-cost' | 'none' | 'unknown';
  assignedAmount: number;
  note: string | null;
}

export interface MinimumBalanceTrendLotDebugRow {
  lotId: string;
  sourceTable: 'Tabla6' | 'Tabla13';
  symbol: string;
  currency: CanonicalCurrency | 'UNKNOWN';
  positionType: string | null;
  assetType: string | null;
  marketValueRule: 'standard' | 'fci-direct-value' | 'caucion-quantity';
  buyDate: string | null;
  sellDate: string | null;
  quantity: number | null;
  investedAmount: number | null;
  historicalPrice: number | null;
  historicalPriceDate: string | null;
  marketValue: number | null;
  benchmarkSource: string | null;
  buyBenchmarkSource: string | null;
  evalBenchmarkSource: string | null;
  buyIndex: number | null;
  buyIndexDate: string | null;
  evalIndex: number | null;
  evalIndexDate: string | null;
  benchmarkRatio: number | null;
  rawMinimumExpected: number | null;
  adjustedMinimumExpected: number | null;
  minimumExpectedUsed: number | null;
  incomeAmount: number;
  capitalReturnedAmount: number;
  comparableValue: number | null;
  balanceVsMinimum: number | null;
  balanceVsMinimumPercent: number | null;
  impactScore: number;
  movements: MinimumBalanceTrendLotMovementDebug[];
  fciCapitalReturnedAmount?: number | null;
  capitalOriginalReconstruido?: number | null;
  capitalExpuestoCosto?: number | null;
  ventasOriginalCostTotales?: number | null;
  ventasOriginalCostHastaFecha?: number | null;
  ventasProceedsHastaFecha?: number | null;
  realizedGainHastaFecha?: number | null;
  baseCapitalUsed: number | null;
  baseCapitalRule: string | null;
  baseCapitalSource: string | null;
  baseCapitalPurchaseAmount: number | null;
  baseCapitalSoldAmount: number | null;
  baseCapitalNetAmount: number | null;
  baseDate: string | null;
  benchmarkStartDate?: string | null;
  benchmarkEndDate?: string | null;
  possibleBaseMismatch: boolean;
  fciSegmentStartDate: string | null;
  fciSegmentBaseCapital: number | null;
  fciSegmentResetReason: string | null;
  fciSegmentThreshold: number | null;
  fciCapitalEvents?: Array<{
    date: string;
    type: 'buy' | 'sell';
    amount: number;
    originalCostAmount: number;
    saleProceedsAmount: number | null;
    realizedGainAmount: number | null;
    sourceTable: 'Tabla6' | 'Tabla13';
    sourceId: string;
    benchmarkIndexBeforeEvent: number | null;
    benchmarkIndexAtEvent: number | null;
    capitalBeforeEvent: number;
    capitalAfterEvent: number;
    benchmarkBalanceBeforeEvent: number;
    benchmarkBalanceAfterEvent: number;
    minimumAccruedBeforeEvent: number;
    minimumAccruedAfterEvent: number;
    includedInOriginalCapital?: boolean;
    reducesExposureAtDate?: boolean;
    soldShare?: number | null;
    minimumExpectedRemoved?: number | null;
  }>;
  skipped: boolean;
  skipReason: string | null;
}

export interface MinimumBalanceTrendPointDebugRow {
  date: string;
  comparableValueARS: number;
  minimumExpectedARS: number;
  balanceVsMinimumARS: number;
  balanceVsMinimumPercent: number | null;
  bestHistorical: boolean;
  worstHistorical: boolean;
  highestComparableValue: boolean;
  highestMinimumExpected: boolean;
  includedLots: number;
  skippedLots: number;
}

export interface MinimumBalanceTrendDateDebugReport {
  date: string;
  benchmarkSourceSelected: CalendarBenchmarkRow['source'] | null;
  benchmarkSourcesAvailable: CalendarBenchmarkRow['source'][];
  totals: {
    comparableValueARS: number;
    minimumExpectedARS: number;
    balanceVsMinimumARS: number;
    balanceVsMinimumPercent: number | null;
    includedLots: number;
    skippedLots: number;
  };
  lots: MinimumBalanceTrendLotDebugRow[];
  warnings: string[];
}

export interface MinimumBalanceTrendPointsDebugReport {
  points: MinimumBalanceTrendPointDebugRow[];
  warnings: string[];
}

export interface MinimumBalanceTrendTopContributorsReport extends MinimumBalanceTrendDateDebugReport {}

export interface MinimumBalanceTrendSkippedLotsReport {
  date: string;
  skippedLots: Array<MinimumBalanceTrendLotDebugRow>;
  skippedByReason: Record<string, number>;
  warnings: string[];
}

export interface MinimumBalanceTrendCurrentComparisonReport {
  benchmarkSourceActual: CalendarBenchmarkRow['source'] | null;
  benchmarkSourceHistorical: CalendarBenchmarkRow['source'] | null;
  current: {
    comparableValueARS: number | null;
    minimumExpectedARS: number | null;
    balanceVsMinimumARS: number | null;
    balanceVsMinimumPercent: number | null;
  };
  lastHistoricalPoint: {
    date: string | null;
    comparableValueARS: number | null;
    minimumExpectedARS: number | null;
    balanceVsMinimumARS: number | null;
    balanceVsMinimumPercent: number | null;
  };
  difference: {
    comparableValueARS: number | null;
    minimumExpectedARS: number | null;
    balanceVsMinimumARS: number | null;
    balanceVsMinimumPercentPoints: number | null;
  };
  omittedByReason: Record<string, number>;
  warnings: string[];
}

export interface MinimumBalanceTrendSymbolPoint extends SeriesPoint {
  meta?: {
    comparableValueARS: number;
    minimumExpectedARS: number;
    balanceVsMinimumARS: number;
    balanceVsMinimumPercent: number | null;
    marketValue: number | null;
    historicalPrice: number | null;
    historicalPriceDate: string | null;
    baseCapitalUsed: number | null;
    baseCapitalRule: string | null;
    baseCapitalSource: string | null;
    benchmarkRatio: number | null;
    included: boolean;
    skipReason: string | null;
    warnings: string[];
  };
}

export interface MinimumBalanceTrendSymbolReport {
  symbol: string;
  currency: 'ARS';
  points: MinimumBalanceTrendSymbolPoint[];
  warnings: string[];
  benchmarkSourceSelected: CalendarBenchmarkRow['source'] | null;
  benchmarkSourcesAvailable: CalendarBenchmarkRow['source'][];
  emptyMessage: string | null;
}

export interface MinimumBalanceTrendSymbolDateReport {
  symbol: string;
  currency: 'ARS';
  date: string;
  marketValue: number | null;
  comparableValue: number | null;
  minimumExpectedUsed: number | null;
  balanceVsMinimum: number | null;
  balanceVsMinimumPercent: number | null;
  baseCapitalUsed: number | null;
  baseCapitalRule: string | null;
  baseCapitalSource: string | null;
  capitalOriginalReconstruido?: number | null;
  capitalExpuestoCosto?: number | null;
  ventasOriginalCostTotales?: number | null;
  ventasOriginalCostHastaFecha?: number | null;
  ventasProceedsHastaFecha?: number | null;
  realizedGainHastaFecha?: number | null;
  benchmarkStartDate?: string | null;
  benchmarkEndDate?: string | null;
  historicalPrice: number | null;
  historicalPriceDate: string | null;
  benchmarkRatio: number | null;
  fciCapitalEvents?: Array<{
    date: string;
    type: 'buy' | 'sell';
    amount: number;
    originalCostAmount: number;
    saleProceedsAmount: number | null;
    realizedGainAmount: number | null;
    sourceTable: 'Tabla6' | 'Tabla13';
    sourceId: string;
    benchmarkIndexBeforeEvent: number | null;
    benchmarkIndexAtEvent: number | null;
    capitalBeforeEvent: number;
    capitalAfterEvent: number;
    benchmarkBalanceBeforeEvent: number;
    benchmarkBalanceAfterEvent: number;
    minimumAccruedBeforeEvent: number;
    minimumAccruedAfterEvent: number;
    soldShare?: number | null;
    minimumExpectedRemoved?: number | null;
    includedInOriginalCapital?: boolean;
    reducesExposureAtDate?: boolean;
  }>;
  included: boolean;
  skipReason: string | null;
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class PortfolioMinimumBalanceTrendService {
  constructor(private readonly minimumPerformance: MinimumPerformanceService) {}

  buildTrend(snapshot: PortfolioAppState, viewMode: 'monthly' | 'daily' = 'monthly'): MinimumBalanceTrendSummary {
    const minimumSummary = this.minimumPerformance.buildMinimumPerformanceSummary(snapshot);
    const bySymbol = this.minimumPerformance.buildMinimumPerformanceBySymbol(snapshot);
    const historical = this.buildHistoricalPoints(snapshot, viewMode);
    const warnings = [...minimumSummary.notes, ...historical.warnings];

    const arsLots = bySymbol.filter((item) => item.currency === 'ARS');
    const underMinimumLots = arsLots.filter((item) => (item.valueVsMinimumAmount ?? 0) < 0);
    const positionsBelowMinimumCount = underMinimumLots.length;
    const totalDeficitBelowMinimumARS = underMinimumLots.reduce(
      (sum, item) => sum + Math.abs(item.valueVsMinimumAmount ?? 0),
      0
    );

    const points = historical.points;
    const trendStatus = this.resolveTrendStatus(points);
    const trendLabel = this.trendLabel(trendStatus);
    const bestHistoricalPoint = this.bestPoint(points);
    const worstHistoricalPoint = this.worstPoint(points);

    return {
      currentBalanceVsMinimumARS: minimumSummary.balanceVsMinimumArs,
      currentBalanceVsMinimumPercent: minimumSummary.balanceVsMinimumPercentArs,
      bestHistoricalBalanceARS: bestHistoricalPoint?.balanceVsMinimumARS ?? null,
      bestHistoricalDate: bestHistoricalPoint?.date ?? null,
      worstHistoricalBalanceARS: worstHistoricalPoint?.balanceVsMinimumARS ?? null,
      worstHistoricalDate: worstHistoricalPoint?.date ?? null,
      change30dARS: this.deltaAtDays(points, 30),
      change90dARS: this.deltaAtDays(points, 90),
      change30dPercentPoints: this.deltaPercentAtDays(points, 30),
      change90dPercentPoints: this.deltaPercentAtDays(points, 90),
      trendStatus,
      trendLabel,
      positionsBelowMinimumCount,
      totalDeficitBelowMinimumARS,
      points,
      source: 'MinimumPerformanceService',
      warnings: this.uniqueWarnings(warnings)
    };
  }

  buildTrendBySymbol(
    snapshot: PortfolioAppState,
    symbol: string,
    viewMode: 'monthly' | 'daily' = 'monthly'
  ): MinimumBalanceTrendSymbolReport {
    const normalizedSymbol = String(symbol ?? '').trim().toUpperCase();
    if (!normalizedSymbol) {
      return {
        symbol: '',
        currency: 'ARS',
        points: [],
        warnings: ['No se indicó una especie válida para construir la serie vs mínimo histórico.'],
        benchmarkSourceSelected: null,
        benchmarkSourcesAvailable: [],
        emptyMessage: 'No hay datos suficientes para reconstruir el vs mínimo histórico de esta especie.'
      };
    }

    const historical = this.buildHistoricalPoints(snapshot, viewMode);
    const evaluationDates =
      viewMode === 'daily'
        ? this.buildSymbolDailyEvaluationDates(snapshot, normalizedSymbol)
        : historical.points
            .map((point) => this.asDate(point.date))
            .filter((date): date is Date => Boolean(date));
    const points: MinimumBalanceTrendSymbolPoint[] = [];
    const warnings = [...historical.warnings];
    let previousPoint: MinimumBalanceTrendSymbolPoint | null = null;

    for (const date of evaluationDates) {
      const report = this.buildDebugReportForDate(snapshot, date);
      const symbolPoint = this.buildSymbolPointFromDebugReport(report, normalizedSymbol);
      if (!symbolPoint.meta?.included) {
        continue;
      }

      if (previousPoint) {
        symbolPoint.changeAmount = symbolPoint.value - previousPoint.value;
        symbolPoint.changePercent =
          previousPoint.value !== 0 ? ((symbolPoint.value - previousPoint.value) / previousPoint.value) * 100 : null;
      }

      previousPoint = symbolPoint;
      points.push(symbolPoint);
      warnings.push(...(symbolPoint.meta?.warnings ?? []));
    }

    return {
      symbol: normalizedSymbol,
      currency: 'ARS',
      points,
      warnings: this.uniqueWarnings(warnings),
      benchmarkSourceSelected: historical.benchmarkSourceSelected,
      benchmarkSourcesAvailable: historical.benchmarkSourcesAvailable,
      emptyMessage: points.length ? null : 'No hay datos suficientes para reconstruir el vs mínimo histórico de esta especie.'
    };
  }

  debugMinimumBalanceTrendPoints(snapshot: PortfolioAppState): MinimumBalanceTrendPointsDebugReport {
    const trend = this.buildTrend(snapshot);
    const best = this.bestPoint(trend.points);
    const worst = this.worstPoint(trend.points);
    const highestComparable = trend.points.reduce<MinimumBalanceTrendPoint | null>((winner, point) => {
      if (!winner || point.comparableValueARS > winner.comparableValueARS) {
        return point;
      }
      return winner;
    }, null);
    const highestMinimum = trend.points.reduce<MinimumBalanceTrendPoint | null>((winner, point) => {
      if (!winner || point.minimumExpectedARS > winner.minimumExpectedARS) {
        return point;
      }
      return winner;
    }, null);

    return {
      points: trend.points.map((point) => ({
        date: this.debugDateKey(point.date) ?? '',
        comparableValueARS: point.comparableValueARS,
        minimumExpectedARS: point.minimumExpectedARS,
        balanceVsMinimumARS: point.balanceVsMinimumARS,
        balanceVsMinimumPercent: point.balanceVsMinimumPercent,
        bestHistorical: best?.date === point.date,
        worstHistorical: worst?.date === point.date,
        highestComparableValue: highestComparable?.date === point.date,
        highestMinimumExpected: highestMinimum?.date === point.date,
        includedLots: 0,
        skippedLots: 0
      })),
      warnings: trend.warnings
    };
  }

  debugMinimumBalanceTrendForDate(snapshot: PortfolioAppState, dateInput: string | Date): MinimumBalanceTrendDateDebugReport {
    const date = this.asDate(dateInput);
    if (!date) {
      return {
        date: String(dateInput ?? ''),
        benchmarkSourceSelected: null,
        benchmarkSourcesAvailable: [],
        totals: {
          comparableValueARS: 0,
          minimumExpectedARS: 0,
          balanceVsMinimumARS: 0,
          balanceVsMinimumPercent: null,
          includedLots: 0,
          skippedLots: 0
        },
        lots: [],
        warnings: ['No se pudo interpretar la fecha solicitada para el debug de Balance vs minimo ARS.']
      };
    }

    return this.buildDebugReportForDate(snapshot, date);
  }

  debugMinimumBalanceTrendTopContributors(snapshot: PortfolioAppState, dateInput: string | Date): MinimumBalanceTrendTopContributorsReport {
    const report = this.debugMinimumBalanceTrendForDate(snapshot, dateInput);
    return {
      ...report,
      lots: [...report.lots]
        .filter((lot) => !lot.skipped)
        .sort((left, right) => this.debugImpactScore(right) - this.debugImpactScore(left))
    };
  }

  debugMinimumBalanceTrendSuspiciousLots(snapshot: PortfolioAppState, dateInput: string | Date): MinimumBalanceTrendDateDebugReport {
    const report = this.debugMinimumBalanceTrendForDate(snapshot, dateInput);
    const suspiciousLots = report.lots.filter((lot) => {
      const ratio = lot.investedAmount && lot.marketValue !== null ? lot.marketValue / lot.investedAmount : null;
      return (
        lot.skipReason === 'valuation-like-instrument' ||
        lot.skipReason === 'suspicious-scale' ||
        (ratio !== null && ratio > 100)
      );
    });

    return {
      ...report,
      lots: suspiciousLots.sort((left, right) => {
        const leftRatio = left.investedAmount && left.marketValue !== null ? left.marketValue / left.investedAmount : 0;
        const rightRatio = right.investedAmount && right.marketValue !== null ? right.marketValue / right.investedAmount : 0;
        return rightRatio - leftRatio;
      })
    };
  }

  debugMinimumBalanceTrendSkippedLots(snapshot: PortfolioAppState, dateInput: string | Date): MinimumBalanceTrendSkippedLotsReport {
    const report = this.debugMinimumBalanceTrendForDate(snapshot, dateInput);
    const skippedLots = report.lots.filter((lot) => lot.skipped);
    const skippedByReason = skippedLots.reduce<Record<string, number>>((acc, lot) => {
      const key = lot.skipReason ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      date: report.date,
      skippedLots,
      skippedByReason,
      warnings: report.warnings
    };
  }

  debugMinimumBalanceTrendCurrentComparison(snapshot: PortfolioAppState): MinimumBalanceTrendCurrentComparisonReport {
    const currentSummary = this.minimumPerformance.buildMinimumPerformanceSummary(snapshot);
    const currentBenchmarkSelection = this.resolveBenchmarkRows(snapshot.dataset?.calendarBenchmarks ?? []);
    const trend = this.buildTrend(snapshot);
    const historicalBenchmarkSelection = this.resolveBenchmarkRows(snapshot.dataset?.calendarBenchmarks ?? []);
    const lastHistoricalPoint = trend.points.at(-1) ?? null;
    const skippedReport = lastHistoricalPoint ? this.debugMinimumBalanceTrendSkippedLots(snapshot, lastHistoricalPoint.date) : null;

    const current = {
      comparableValueARS: currentSummary.currentComparableArs,
      minimumExpectedARS: currentSummary.minimumExpectedArs,
      balanceVsMinimumARS: currentSummary.balanceVsMinimumArs,
      balanceVsMinimumPercent: currentSummary.balanceVsMinimumPercentArs
    };

    const historical = lastHistoricalPoint
      ? {
          date: this.debugDateKey(lastHistoricalPoint.date),
          comparableValueARS: lastHistoricalPoint.comparableValueARS,
          minimumExpectedARS: lastHistoricalPoint.minimumExpectedARS,
          balanceVsMinimumARS: lastHistoricalPoint.balanceVsMinimumARS,
          balanceVsMinimumPercent: lastHistoricalPoint.balanceVsMinimumPercent
        }
      : {
          date: null,
          comparableValueARS: null,
          minimumExpectedARS: null,
          balanceVsMinimumARS: null,
          balanceVsMinimumPercent: null
        };

    const difference = {
      comparableValueARS:
        current.comparableValueARS !== null && historical.comparableValueARS !== null
          ? current.comparableValueARS - historical.comparableValueARS
          : null,
      minimumExpectedARS:
        current.minimumExpectedARS !== null && historical.minimumExpectedARS !== null
          ? current.minimumExpectedARS - historical.minimumExpectedARS
          : null,
      balanceVsMinimumARS:
        current.balanceVsMinimumARS !== null && historical.balanceVsMinimumARS !== null
          ? current.balanceVsMinimumARS - historical.balanceVsMinimumARS
          : null,
      balanceVsMinimumPercentPoints:
        current.balanceVsMinimumPercent !== null && historical.balanceVsMinimumPercent !== null
          ? current.balanceVsMinimumPercent - historical.balanceVsMinimumPercent
          : null
    };

    return {
      benchmarkSourceActual: currentBenchmarkSelection.source,
      benchmarkSourceHistorical: historicalBenchmarkSelection.source,
      current,
      lastHistoricalPoint: historical,
      difference,
      omittedByReason: skippedReport?.skippedByReason ?? {},
      warnings: this.uniqueWarnings([
        ...trend.warnings,
        ...(currentBenchmarkSelection.source !== historicalBenchmarkSelection.source
          ? ['El histórico usa una fuente de benchmark distinta al cálculo actual.']
          : []),
        ...(skippedReport?.warnings ?? [])
      ])
    };
  }

  debugMinimumBalanceTrendForSymbol(snapshot: PortfolioAppState, symbol: string): MinimumBalanceTrendSymbolReport {
    return this.buildTrendBySymbol(snapshot, symbol);
  }

  debugMinimumBalanceTrendForSymbolAtDate(
    snapshot: PortfolioAppState,
    symbol: string,
    dateInput: string | Date
  ): MinimumBalanceTrendSymbolDateReport {
    const date = this.asDate(dateInput);
    const normalizedSymbol = String(symbol ?? '').trim().toUpperCase();
    if (!date || !normalizedSymbol) {
      return {
        symbol: normalizedSymbol,
        currency: 'ARS',
        date: String(dateInput ?? ''),
        marketValue: null,
        comparableValue: null,
        minimumExpectedUsed: null,
        balanceVsMinimum: null,
        balanceVsMinimumPercent: null,
        baseCapitalUsed: null,
        baseCapitalRule: null,
        baseCapitalSource: null,
        historicalPrice: null,
        historicalPriceDate: null,
        benchmarkRatio: null,
        included: false,
        skipReason: 'invalid-input',
        warnings: ['No se pudo interpretar la especie o la fecha solicitada para el debug de Balance vs minimo ARS.']
      };
    }

    const report = this.buildDebugReportForDate(snapshot, date);
    return this.buildSymbolDateReportFromDebugReport(report, normalizedSymbol);
  }

  private buildSymbolPointFromDebugReport(
    report: MinimumBalanceTrendDateDebugReport,
    normalizedSymbol: string
  ): MinimumBalanceTrendSymbolPoint {
    const symbolRows = report.lots.filter((lot) => lot.symbol.trim().toUpperCase() === normalizedSymbol);
    const includedRows = symbolRows.filter(
      (lot) => !lot.skipped && lot.currency === 'ARS' && lot.comparableValue !== null && lot.minimumExpectedUsed !== null
    );
    const warnings = this.uniqueWarnings([
      ...report.warnings,
      ...symbolRows.filter((lot) => lot.skipped && lot.skipReason).map((lot) => `${lot.symbol}: ${lot.skipReason}`)
    ]);
    const date = report.date;
    const formattedDate = this.asDate(date) ? this.formatDate(this.asDate(date)!) : date;
    const historicalPrice = this.pickLatestNumber(symbolRows.map((row) => row.historicalPrice));
    const historicalPriceDate = this.pickLatestDate(symbolRows.map((row) => row.historicalPriceDate));
    const marketValue = this.sumNumbers(includedRows.map((row) => row.marketValue));
    const comparableValue = this.sumNumbers(includedRows.map((row) => row.comparableValue));
    const minimumExpectedUsed = this.sumNumbers(includedRows.map((row) => row.minimumExpectedUsed));
    const baseCapitalUsed = this.sumNumbers(includedRows.map((row) => row.baseCapitalUsed));
    const balanceVsMinimumARS = comparableValue - minimumExpectedUsed;
    const balanceVsMinimumPercent = minimumExpectedUsed > 0 ? ((comparableValue / minimumExpectedUsed) - 1) * 100 : null;
    const benchmarkRatio = baseCapitalUsed > 0 ? minimumExpectedUsed / baseCapitalUsed : null;
    const baseCapitalRule = this.joinUniqueStrings(includedRows.map((row) => row.baseCapitalRule), 'by-symbol-aggregate');
    const baseCapitalSource = this.joinUniqueStrings(includedRows.map((row) => row.baseCapitalSource), 'agregado por símbolo');
    const skipReason = symbolRows.find((lot) => lot.skipReason)?.skipReason ?? 'symbol-not-in-series';

    return {
      label: formattedDate,
      value: balanceVsMinimumARS,
      date: formattedDate,
      changeAmount: null,
      changePercent: null,
      tooltip: `${normalizedSymbol} · ${date} · ${balanceVsMinimumARS}`,
      meta: {
        comparableValueARS: comparableValue,
        minimumExpectedARS: minimumExpectedUsed,
        balanceVsMinimumARS,
        balanceVsMinimumPercent,
        marketValue,
        historicalPrice,
        historicalPriceDate,
        baseCapitalUsed,
        baseCapitalRule,
        baseCapitalSource,
        benchmarkRatio,
        included: includedRows.length > 0,
        skipReason: includedRows.length > 0 ? null : skipReason,
        warnings
      }
    };
  }

  private buildSymbolDateReportFromDebugReport(
    report: MinimumBalanceTrendDateDebugReport,
    normalizedSymbol: string
  ): MinimumBalanceTrendSymbolDateReport {
    const symbolPoint = this.buildSymbolPointFromDebugReport(report, normalizedSymbol);
    const included = Boolean(symbolPoint.meta?.included);
    const symbolRows = report.lots.filter((lot) => lot.symbol.trim().toUpperCase() === normalizedSymbol);
    const includedRows = symbolRows.filter((lot) => !lot.skipped && lot.currency === 'ARS' && lot.comparableValue !== null && lot.minimumExpectedUsed !== null);
    const fciReferenceRow = includedRows[0] ?? symbolRows[0] ?? null;
    return {
      symbol: normalizedSymbol,
      currency: 'ARS',
      date: report.date,
      marketValue: included ? symbolPoint.meta?.marketValue ?? null : null,
      comparableValue: included ? symbolPoint.meta?.comparableValueARS ?? null : null,
      minimumExpectedUsed: included ? symbolPoint.meta?.minimumExpectedARS ?? null : null,
      balanceVsMinimum: included ? symbolPoint.meta?.balanceVsMinimumARS ?? null : null,
      balanceVsMinimumPercent: included ? symbolPoint.meta?.balanceVsMinimumPercent ?? null : null,
      baseCapitalUsed: included ? symbolPoint.meta?.baseCapitalUsed ?? null : null,
      baseCapitalRule: included ? symbolPoint.meta?.baseCapitalRule ?? null : null,
      baseCapitalSource: included ? symbolPoint.meta?.baseCapitalSource ?? null : null,
      capitalOriginalReconstruido: included ? fciReferenceRow?.capitalOriginalReconstruido ?? null : null,
      capitalExpuestoCosto: included ? fciReferenceRow?.capitalExpuestoCosto ?? null : null,
      ventasOriginalCostTotales: included ? fciReferenceRow?.ventasOriginalCostTotales ?? null : null,
      ventasOriginalCostHastaFecha: included ? fciReferenceRow?.ventasOriginalCostHastaFecha ?? null : null,
      ventasProceedsHastaFecha: included ? fciReferenceRow?.ventasProceedsHastaFecha ?? null : null,
      realizedGainHastaFecha: included ? fciReferenceRow?.realizedGainHastaFecha ?? null : null,
      benchmarkStartDate: included ? fciReferenceRow?.benchmarkStartDate ?? null : null,
      benchmarkEndDate: included ? fciReferenceRow?.benchmarkEndDate ?? null : null,
      historicalPrice: included ? symbolPoint.meta?.historicalPrice ?? null : null,
      historicalPriceDate: included ? symbolPoint.meta?.historicalPriceDate ?? null : null,
      benchmarkRatio: included ? symbolPoint.meta?.benchmarkRatio ?? null : null,
      fciCapitalEvents: included
        ? fciReferenceRow?.fciCapitalEvents?.map((event) => ({ ...event }))
        : undefined,
      included,
      skipReason: symbolPoint.meta?.skipReason ?? null,
      warnings: symbolPoint.meta?.warnings ?? []
    };
  }

  private buildHistoricalPoints(snapshot: PortfolioAppState, viewMode: 'monthly' | 'daily' = 'monthly'): HistoricalPointBuildResult {
    const warnings: string[] = [];
    const dataset = snapshot.dataset;
    const fciSymbols = this.extractFciSymbols(snapshot.workbook?.tables ?? []);

    if (!dataset) {
      return {
        points: [],
        benchmarkSourceSelected: null,
        benchmarkSourcesAvailable: [],
        warnings: [
          'No hay serie histórica confiable de Balance vs mínimo ARS.',
          'No hay dataset disponible para construir la serie histórica de Balance vs mínimo ARS.'
        ]
      };
    }

    const evaluationDates = viewMode === 'daily'
      ? this.buildDailyEvaluationDates(dataset)
      : this.buildMonthlyEvaluationDates(dataset.monthlySummary ?? []);
    if (!evaluationDates.length) {
      return {
        points: [],
        benchmarkSourceSelected: null,
        benchmarkSourcesAvailable: [],
        warnings: [
          'No hay serie histórica confiable de Balance vs mínimo ARS.',
          viewMode === 'daily'
            ? 'No hay historial diario suficiente para construir la serie histórica de Balance vs mínimo ARS.'
            : 'No hay historial mensual suficiente para construir la serie histórica de Balance vs mínimo ARS.'
        ]
      };
    }

    const lots = this.buildHistoricalLots(
      dataset.operations ?? [],
      dataset.sales ?? [],
      this.buildLotMetadataBySymbol(dataset.positions ?? [], dataset.classifications ?? []),
      fciSymbols
    );
    const arsLots = lots.filter((lot) => lot.currency === 'ARS' && lot.buyDate !== null);
    if (!arsLots.length) {
      return {
        points: [],
        benchmarkSourceSelected: null,
        benchmarkSourcesAvailable: [],
        warnings: [
          'No hay serie histórica confiable de Balance vs mínimo ARS.',
          'No hay lotes ARS suficientes para construir la serie histórica de Balance vs mínimo ARS.'
        ]
      };
    }

    const priceIndex = this.indexHistoricalPrices(dataset.historicalPrices ?? []);
    const benchmarkSelection = this.resolveBenchmarkRows(dataset.calendarBenchmarks ?? []);
    const benchmarkRows = benchmarkSelection.rows;
    if (!benchmarkRows.length) {
      return {
        points: [],
        benchmarkSourceSelected: benchmarkSelection.source,
        benchmarkSourcesAvailable: benchmarkSelection.availableSources,
        warnings: [
          'No hay serie histórica confiable de Balance vs mínimo ARS.',
          'No hay benchmark mínimo suficiente para construir la serie histórica de Balance vs mínimo ARS.'
        ]
      };
    }

    const movementsIndex = this.indexMovements(dataset.investmentMovements ?? []);
    const points: MinimumBalanceTrendPoint[] = [];

    for (const date of evaluationDates) {
      const point = this.buildPointForDate({
        date,
        lots: arsLots,
        operations: dataset.operations ?? [],
        sales: dataset.sales ?? [],
        priceIndex,
        benchmarkRows,
        movementsIndex,
        fciSymbols,
        warnings
      });
      if (point) {
        points.push(point);
      }
    }

    if (!points.length) {
      warnings.push('No hay serie histórica confiable de Balance vs mínimo ARS.');
      warnings.push('No se pudieron reconstruir puntos históricos confiables de Balance vs mínimo ARS.');
    } else {
      const currentSummary = this.minimumPerformance.buildMinimumPerformanceSummary(snapshot);
      const currentBalance = currentSummary.balanceVsMinimumArs;
      const lastPoint = points.at(-1) ?? null;
      if (currentBalance !== null && lastPoint) {
        const diff = Math.abs(lastPoint.balanceVsMinimumARS - currentBalance);
        const threshold = Math.max(1, Math.abs(currentBalance) * 0.15);
        if (diff > threshold) {
          warnings.push('El último punto histórico difiere significativamente del cálculo actual de Balance vs mínimo.');
        }
      }
      if (currentBalance !== null && lastPoint) {
        const diff = Math.abs(lastPoint.balanceVsMinimumARS - currentBalance);
        const threshold = Math.max(1, Math.abs(currentBalance) * 0.15);
        if (diff > threshold) {
          warnings.push(
            `Último punto histórico: ${this.debugDateKey(lastPoint.date) ?? 'N/D'}. Si la diferencia con el cálculo actual persiste, revisar lotes omitidos, FCI, cauciones o precios históricos.`
          );
        }
      }
    }

    return {
      points,
      warnings: this.uniqueWarnings([
        ...benchmarkSelection.notes,
        ...warnings
      ]),
      benchmarkSourceSelected: benchmarkSelection.source,
      benchmarkSourcesAvailable: benchmarkSelection.availableSources
    };
  }

  private buildDebugReportForDate(snapshot: PortfolioAppState, date: Date): MinimumBalanceTrendDateDebugReport {
    const warnings: string[] = [];
    const dataset = snapshot.dataset;
    const fciSymbols = this.extractFciSymbols(snapshot.workbook?.tables ?? []);

    if (!dataset) {
      return {
        date: this.debugDateKey(date) ?? date.toISOString().slice(0, 10),
        benchmarkSourceSelected: null,
        benchmarkSourcesAvailable: [],
        totals: {
          comparableValueARS: 0,
          minimumExpectedARS: 0,
          balanceVsMinimumARS: 0,
          balanceVsMinimumPercent: null,
          includedLots: 0,
          skippedLots: 0
        },
        lots: [],
        warnings: ['No hay dataset disponible para el debug de Balance vs minimo ARS.']
      };
    }

    const lots = this.buildHistoricalLots(
      dataset.operations ?? [],
      dataset.sales ?? [],
      this.buildLotMetadataBySymbol(dataset.positions ?? [], dataset.classifications ?? []),
      fciSymbols
    );
    const benchmarkSelection = this.resolveBenchmarkRows(dataset.calendarBenchmarks ?? []);
    const benchmarkRows = benchmarkSelection.rows;
    const priceIndex = this.indexHistoricalPrices(dataset.historicalPrices ?? []);
    const movementsIndex = this.indexMovements(dataset.investmentMovements ?? []);
    const fciCapitalBaseBySymbol = this.buildFciCapitalBaseBySymbol(dataset.operations ?? [], dataset.sales ?? [], date, fciSymbols);
    const fciSegmentBySymbol = this.buildFciHistoricalSegmentContextBySymbol(priceIndex, date, fciSymbols);
    const activeLots = lots.filter((lot) => lot.currency === 'ARS' && this.isLotActiveAtDate(lot, date));
    const movementTotalsByLot = this.buildMovementTotalsByLot(activeLots, movementsIndex, date, warnings);
    const activeSymbolBaseLots = new Map<string, HistoricalLot[]>();
    for (const lot of lots.filter((item) => item.sourceTable === 'Tabla6' && this.isLotActiveAtDate(item, date))) {
      const bucket = activeSymbolBaseLots.get(lot.symbol) ?? [];
      bucket.push(lot);
      activeSymbolBaseLots.set(lot.symbol, bucket);
    }
    const processedSpecialSymbols = new Set<string>();

    const rows = lots.map((lot) => {
      const symbol = lot.symbol;
      if ((lot.instrumentKind === 'fci' || lot.instrumentKind === 'caucion') && processedSpecialSymbols.has(symbol)) {
        return {
          lotId: lot.id,
          sourceTable: lot.sourceTable,
          symbol: lot.symbol,
          currency: lot.currency,
          positionType: lot.positionType,
          assetType: lot.assetType,
          marketValueRule: 'fci-direct-value',
          buyDate: this.debugDateKey(lot.buyDate),
          sellDate: this.debugDateKey(lot.sellDate),
          quantity: lot.quantity,
          investedAmount: lot.investedAmount,
          historicalPrice: null,
          historicalPriceDate: null,
          marketValue: null,
          benchmarkSource: null,
          buyBenchmarkSource: null,
          evalBenchmarkSource: null,
          buyIndex: null,
          buyIndexDate: null,
          evalIndex: null,
          evalIndexDate: null,
          benchmarkRatio: null,
          rawMinimumExpected: null,
          adjustedMinimumExpected: null,
          minimumExpectedUsed: null,
          incomeAmount: 0,
          capitalReturnedAmount: 0,
          comparableValue: null,
          balanceVsMinimum: null,
          balanceVsMinimumPercent: null,
          impactScore: 0,
          movements: [],
          fciCapitalReturnedAmount: null,
          baseCapitalUsed: null,
          baseCapitalRule: null,
          baseCapitalSource: null,
          baseCapitalPurchaseAmount: null,
          baseCapitalSoldAmount: null,
          baseCapitalNetAmount: null,
          baseDate: null,
          fciSegmentStartDate: null,
          fciSegmentBaseCapital: null,
          fciSegmentResetReason: null,
          fciSegmentThreshold: null,
          fciCapitalEvents: [],
          possibleBaseMismatch: false,
          skipped: true,
          skipReason: lot.instrumentKind === 'fci' ? 'fci-consolidated-duplicate' : 'caucion-consolidated-duplicate'
        } satisfies MinimumBalanceTrendLotDebugRow;
      }

      if (lot.instrumentKind === 'fci' && lot.sourceTable === 'Tabla13') {
        const hasActiveBase = (activeSymbolBaseLots.get(lot.symbol)?.length ?? 0) > 0;
        return {
          lotId: lot.id,
          sourceTable: lot.sourceTable,
          symbol: lot.symbol,
          currency: lot.currency,
          positionType: lot.positionType,
          assetType: lot.assetType,
          marketValueRule: 'fci-direct-value',
          buyDate: this.debugDateKey(lot.buyDate),
          sellDate: this.debugDateKey(lot.sellDate),
          quantity: lot.quantity,
          investedAmount: lot.investedAmount,
          historicalPrice: null,
          historicalPriceDate: null,
          marketValue: null,
          benchmarkSource: null,
          buyBenchmarkSource: null,
          evalBenchmarkSource: null,
          buyIndex: null,
          buyIndexDate: null,
          evalIndex: null,
          evalIndexDate: null,
          benchmarkRatio: null,
          rawMinimumExpected: null,
          adjustedMinimumExpected: null,
          minimumExpectedUsed: null,
          incomeAmount: 0,
          capitalReturnedAmount: 0,
          comparableValue: null,
          balanceVsMinimum: null,
          balanceVsMinimumPercent: null,
          impactScore: 0,
          movements: [],
          fciCapitalReturnedAmount: null,
          baseCapitalUsed: null,
          baseCapitalRule: null,
          baseCapitalSource: null,
          baseCapitalPurchaseAmount: null,
          baseCapitalSoldAmount: null,
          baseCapitalNetAmount: null,
          baseDate: null,
          fciSegmentStartDate: null,
          fciSegmentBaseCapital: null,
          fciSegmentResetReason: null,
          fciSegmentThreshold: null,
          fciCapitalEvents: [],
          possibleBaseMismatch: false,
          skipped: true,
          skipReason: hasActiveBase ? 'fci-sale-ignored-when-fci-active' : 'fci-sale-without-active-position'
        } satisfies MinimumBalanceTrendLotDebugRow;
      }

      if (lot.instrumentKind === 'caucion' && lot.sourceTable === 'Tabla13' && (activeSymbolBaseLots.get(lot.symbol)?.length ?? 0) > 0) {
        return {
          lotId: lot.id,
          sourceTable: lot.sourceTable,
          symbol: lot.symbol,
          currency: lot.currency,
          positionType: lot.positionType,
          assetType: lot.assetType,
          marketValueRule: 'caucion-quantity',
          buyDate: this.debugDateKey(lot.buyDate),
          sellDate: this.debugDateKey(lot.sellDate),
          quantity: lot.quantity,
          investedAmount: lot.investedAmount,
          historicalPrice: null,
          historicalPriceDate: null,
          marketValue: null,
          benchmarkSource: null,
          buyBenchmarkSource: null,
          evalBenchmarkSource: null,
          buyIndex: null,
          buyIndexDate: null,
          evalIndex: null,
          evalIndexDate: null,
          benchmarkRatio: null,
          rawMinimumExpected: null,
          adjustedMinimumExpected: null,
          minimumExpectedUsed: null,
          incomeAmount: 0,
          capitalReturnedAmount: 0,
          comparableValue: null,
          balanceVsMinimum: null,
          balanceVsMinimumPercent: null,
          impactScore: 0,
          movements: [],
          fciCapitalReturnedAmount: null,
          baseCapitalUsed: null,
          baseCapitalRule: null,
          baseCapitalSource: null,
          baseCapitalPurchaseAmount: null,
          baseCapitalSoldAmount: null,
          baseCapitalNetAmount: null,
          baseDate: null,
          fciSegmentStartDate: null,
          fciSegmentBaseCapital: null,
          fciSegmentResetReason: null,
          fciSegmentThreshold: null,
          fciCapitalEvents: [],
          possibleBaseMismatch: false,
          skipped: true,
          skipReason: 'caucion-sale-ignored-when-active-base-exists'
        } satisfies MinimumBalanceTrendLotDebugRow;
      }

      if (lot.instrumentKind === 'fci' || lot.instrumentKind === 'caucion') {
        const symbolLots = lots.filter((item) => item.symbol === lot.symbol);
        const instrumentKind = this.resolveHistoricalInstrumentKind(symbolLots, fciSymbols);
        const baseInfo = instrumentKind === 'fci' ? fciCapitalBaseBySymbol.get(symbol) ?? null : null;
        const segmentInfo = instrumentKind === 'fci' ? fciSegmentBySymbol.get(symbol) ?? null : null;
        const consolidated = this.buildConsolidatedHistoricalLot(symbolLots, date, instrumentKind as 'fci' | 'caucion');
        if (!consolidated) {
          return {
            lotId: lot.id,
            sourceTable: lot.sourceTable,
            symbol: lot.symbol,
            currency: lot.currency,
            positionType: lot.positionType,
          assetType: lot.assetType,
          marketValueRule: instrumentKind === 'fci' ? 'fci-direct-value' : 'caucion-quantity',
          buyDate: this.debugDateKey(lot.buyDate),
            sellDate: this.debugDateKey(lot.sellDate),
            quantity: lot.quantity,
            investedAmount: lot.investedAmount,
            historicalPrice: null,
            historicalPriceDate: null,
            marketValue: null,
            benchmarkSource: null,
            buyBenchmarkSource: null,
            evalBenchmarkSource: null,
            buyIndex: null,
            buyIndexDate: null,
            evalIndex: null,
            evalIndexDate: null,
            benchmarkRatio: null,
            rawMinimumExpected: null,
            adjustedMinimumExpected: null,
            minimumExpectedUsed: null,
            incomeAmount: 0,
            capitalReturnedAmount: 0,
            comparableValue: null,
            balanceVsMinimum: null,
            balanceVsMinimumPercent: null,
            impactScore: 0,
            movements: [],
            fciCapitalReturnedAmount: null,
            baseCapitalUsed: null,
            baseCapitalRule: null,
            baseCapitalSource: null,
          baseCapitalPurchaseAmount: null,
          baseCapitalSoldAmount: null,
          baseCapitalNetAmount: null,
          baseDate: null,
            fciSegmentStartDate: null,
            fciSegmentBaseCapital: null,
            fciSegmentResetReason: null,
            fciSegmentThreshold: null,
            fciCapitalEvents: [],
            possibleBaseMismatch: false,
            skipped: true,
            skipReason:
              instrumentKind === 'fci'
                ? 'fci-sale-without-active-position'
                : 'caucion-sale-ignored-when-active-base-exists'
          } satisfies MinimumBalanceTrendLotDebugRow;
        }

        const resolvedFciBaseCapital =
          instrumentKind === 'fci'
            ? (baseInfo?.netAmount && baseInfo.netAmount > 0
                ? baseInfo.netAmount
                : segmentInfo?.baseCapital && segmentInfo.baseCapital > 0
                  ? segmentInfo.baseCapital
                  : this.priceAtOrBeforeInfo(priceIndex, consolidated.symbol, date).price)
            : null;

        const contribution = this.buildHistoricalLotContribution({
          lot:
            instrumentKind === 'fci' && (resolvedFciBaseCapital ?? 0) > 0
              ? {
                  ...consolidated,
                  investedAmount: resolvedFciBaseCapital
                }
              : consolidated,
          date,
          priceIndex,
          benchmarkRows,
          movementTotalsByLot,
          warnings,
          marketValueRule: instrumentKind === 'fci' ? 'fci-direct-value' : 'caucion-quantity',
          investedAmountOverride: instrumentKind === 'fci' ? resolvedFciBaseCapital ?? undefined : undefined,
          baseCapitalInfo: instrumentKind === 'fci' ? baseInfo ?? null : null,
          fciSegmentContext: instrumentKind === 'fci' ? segmentInfo : null
        });

        processedSpecialSymbols.add(symbol);

        return {
          lotId: consolidated.id,
          sourceTable: consolidated.sourceTable,
          symbol: consolidated.symbol,
          currency: consolidated.currency,
          positionType: consolidated.positionType,
          assetType: consolidated.assetType,
          marketValueRule: contribution.marketValueRule,
          buyDate: this.debugDateKey(consolidated.buyDate),
          sellDate: this.debugDateKey(consolidated.sellDate),
          quantity: consolidated.quantity,
          investedAmount: consolidated.investedAmount,
          historicalPrice: contribution.historicalPrice,
          historicalPriceDate: this.debugDateKey(contribution.historicalPriceDate),
          marketValue: contribution.marketValue,
          benchmarkSource: contribution.benchmarkSource,
          buyBenchmarkSource: contribution.buyBenchmarkSource,
          evalBenchmarkSource: contribution.evalBenchmarkSource,
          buyIndex: contribution.buyIndex,
          buyIndexDate: this.debugDateKey(contribution.buyIndexDate),
          evalIndex: contribution.evalIndex,
          evalIndexDate: this.debugDateKey(contribution.evalIndexDate),
          benchmarkRatio: contribution.benchmarkRatio,
          rawMinimumExpected: contribution.rawMinimumExpected,
          adjustedMinimumExpected: contribution.adjustedMinimumExpected,
          minimumExpectedUsed: contribution.minimumExpectedUsed,
          incomeAmount: contribution.incomeAmount,
          capitalReturnedAmount: contribution.capitalReturnedAmount,
          comparableValue: contribution.comparableValue,
          balanceVsMinimum: contribution.balanceVsMinimum,
          balanceVsMinimumPercent: contribution.balanceVsMinimumPercent,
          impactScore: contribution.impactScore,
          movements: contribution.movements.map((movement) => ({
            date: this.debugDateKey(movement.date) ?? '',
            type: movement.type,
            amount: movement.amount,
            affectsPerformance: movement.affectsPerformance,
            affectsInvestedCapital: movement.affectsInvestedCapital,
            capitalEffect: movement.capitalEffect,
            assignedAmount: movement.assignedAmount,
            note: movement.note
          })),
          fciCapitalReturnedAmount: contribution.fciCapitalReturnedAmount ?? null,
          capitalOriginalReconstruido: contribution.capitalOriginalReconstruido ?? null,
          capitalExpuestoCosto: contribution.capitalExpuestoCosto ?? null,
          ventasOriginalCostTotales: contribution.ventasOriginalCostTotales ?? null,
          ventasOriginalCostHastaFecha: contribution.ventasOriginalCostHastaFecha ?? null,
          ventasProceedsHastaFecha: contribution.ventasProceedsHastaFecha ?? null,
          realizedGainHastaFecha: contribution.realizedGainHastaFecha ?? null,
          baseCapitalUsed: contribution.baseCapitalUsed,
          baseCapitalRule: contribution.baseCapitalRule,
          baseCapitalSource: contribution.baseCapitalSource,
          baseCapitalPurchaseAmount: contribution.baseCapitalPurchaseAmount,
          baseCapitalSoldAmount: contribution.baseCapitalSoldAmount,
          baseCapitalNetAmount: contribution.baseCapitalNetAmount,
          baseDate: this.debugDateKey(contribution.baseDate),
          benchmarkStartDate: this.debugDateKey(contribution.benchmarkStartDate ?? null),
          benchmarkEndDate: this.debugDateKey(contribution.benchmarkEndDate ?? null),
          fciSegmentStartDate: this.debugDateKey(contribution.fciSegmentStartDate),
          fciSegmentBaseCapital: contribution.fciSegmentBaseCapital,
          fciSegmentResetReason: contribution.fciSegmentResetReason,
          fciSegmentThreshold: contribution.fciSegmentThreshold,
          fciCapitalEvents: (contribution.fciCapitalEvents ?? []).map((event) => ({
            date: this.debugDateKey(event.date) ?? '',
            type: event.type,
            amount: event.amount,
            originalCostAmount: event.originalCostAmount,
            saleProceedsAmount: event.saleProceedsAmount,
            realizedGainAmount: event.realizedGainAmount,
            sourceTable: event.sourceTable,
            sourceId: event.sourceId,
            benchmarkIndexBeforeEvent: event.benchmarkIndexBeforeEvent,
            benchmarkIndexAtEvent: event.benchmarkIndexAtEvent,
            capitalBeforeEvent: event.capitalBeforeEvent,
            capitalAfterEvent: event.capitalAfterEvent,
            benchmarkBalanceBeforeEvent: event.benchmarkBalanceBeforeEvent,
            benchmarkBalanceAfterEvent: event.benchmarkBalanceAfterEvent,
            minimumAccruedBeforeEvent: event.minimumAccruedBeforeEvent,
            minimumAccruedAfterEvent: event.minimumAccruedAfterEvent,
            soldShare: event.soldShare ?? null,
            minimumExpectedRemoved: event.minimumExpectedRemoved ?? null,
            includedInOriginalCapital: true,
            reducesExposureAtDate: event.type === 'sell' && event.date.getTime() <= date.getTime()
          })),
          possibleBaseMismatch: contribution.possibleBaseMismatch,
          skipped: contribution.skipped,
          skipReason: contribution.skipReason
        } satisfies MinimumBalanceTrendLotDebugRow;
      }

      const contribution = this.buildHistoricalLotContribution({
        lot,
        date,
        priceIndex,
        benchmarkRows,
        movementTotalsByLot,
        warnings,
        marketValueRule: this.resolveHistoricalMarketValueRule(lot)
      });

      return {
        lotId: lot.id,
        sourceTable: lot.sourceTable,
        symbol: lot.symbol,
        currency: lot.currency,
        positionType: lot.positionType,
        assetType: lot.assetType,
        marketValueRule: contribution.marketValueRule,
        buyDate: this.debugDateKey(lot.buyDate),
        sellDate: this.debugDateKey(lot.sellDate),
        quantity: lot.quantity,
        investedAmount: lot.investedAmount,
        historicalPrice: contribution.historicalPrice,
        historicalPriceDate: this.debugDateKey(contribution.historicalPriceDate),
        marketValue: contribution.marketValue,
        benchmarkSource: contribution.benchmarkSource,
        buyBenchmarkSource: contribution.buyBenchmarkSource,
        evalBenchmarkSource: contribution.evalBenchmarkSource,
        buyIndex: contribution.buyIndex,
        buyIndexDate: this.debugDateKey(contribution.buyIndexDate),
        evalIndex: contribution.evalIndex,
        evalIndexDate: this.debugDateKey(contribution.evalIndexDate),
        benchmarkRatio: contribution.benchmarkRatio,
        rawMinimumExpected: contribution.rawMinimumExpected,
        adjustedMinimumExpected: contribution.adjustedMinimumExpected,
        minimumExpectedUsed: contribution.minimumExpectedUsed,
        incomeAmount: contribution.incomeAmount,
        capitalReturnedAmount: contribution.capitalReturnedAmount,
        comparableValue: contribution.comparableValue,
        balanceVsMinimum: contribution.balanceVsMinimum,
        balanceVsMinimumPercent: contribution.balanceVsMinimumPercent,
        impactScore: contribution.impactScore,
        movements: contribution.movements.map((movement) => ({
          date: this.debugDateKey(movement.date) ?? '',
          type: movement.type,
          amount: movement.amount,
          affectsPerformance: movement.affectsPerformance,
          affectsInvestedCapital: movement.affectsInvestedCapital,
          capitalEffect: movement.capitalEffect,
          assignedAmount: movement.assignedAmount,
          note: movement.note
        })),
        fciCapitalReturnedAmount: contribution.fciCapitalReturnedAmount ?? null,
        capitalOriginalReconstruido: contribution.capitalOriginalReconstruido ?? null,
        capitalExpuestoCosto: contribution.capitalExpuestoCosto ?? null,
        ventasOriginalCostTotales: contribution.ventasOriginalCostTotales ?? null,
        ventasOriginalCostHastaFecha: contribution.ventasOriginalCostHastaFecha ?? null,
        ventasProceedsHastaFecha: contribution.ventasProceedsHastaFecha ?? null,
        realizedGainHastaFecha: contribution.realizedGainHastaFecha ?? null,
        baseCapitalUsed: contribution.baseCapitalUsed,
        baseCapitalRule: contribution.baseCapitalRule,
        baseCapitalSource: contribution.baseCapitalSource,
        baseCapitalPurchaseAmount: contribution.baseCapitalPurchaseAmount,
        baseCapitalSoldAmount: contribution.baseCapitalSoldAmount,
        baseCapitalNetAmount: contribution.baseCapitalNetAmount,
        baseDate: this.debugDateKey(contribution.baseDate),
        benchmarkStartDate: this.debugDateKey(contribution.benchmarkStartDate ?? null),
        benchmarkEndDate: this.debugDateKey(contribution.benchmarkEndDate ?? null),
        fciSegmentStartDate: this.debugDateKey(contribution.fciSegmentStartDate),
        fciSegmentBaseCapital: contribution.fciSegmentBaseCapital,
        fciSegmentResetReason: contribution.fciSegmentResetReason,
        fciSegmentThreshold: contribution.fciSegmentThreshold,
        fciCapitalEvents: (contribution.fciCapitalEvents ?? []).map((event) => ({
          date: this.debugDateKey(event.date) ?? '',
          type: event.type,
          amount: event.amount,
          originalCostAmount: event.originalCostAmount,
          saleProceedsAmount: event.saleProceedsAmount,
          realizedGainAmount: event.realizedGainAmount,
          sourceTable: event.sourceTable,
          sourceId: event.sourceId,
          benchmarkIndexBeforeEvent: event.benchmarkIndexBeforeEvent,
          benchmarkIndexAtEvent: event.benchmarkIndexAtEvent,
          capitalBeforeEvent: event.capitalBeforeEvent,
          capitalAfterEvent: event.capitalAfterEvent,
          benchmarkBalanceBeforeEvent: event.benchmarkBalanceBeforeEvent,
          benchmarkBalanceAfterEvent: event.benchmarkBalanceAfterEvent,
          minimumAccruedBeforeEvent: event.minimumAccruedBeforeEvent,
          minimumAccruedAfterEvent: event.minimumAccruedAfterEvent,
          soldShare: event.soldShare ?? null,
          minimumExpectedRemoved: event.minimumExpectedRemoved ?? null,
          includedInOriginalCapital: true,
          reducesExposureAtDate: event.type === 'sell' && event.date.getTime() <= date.getTime()
        })),
        possibleBaseMismatch: contribution.possibleBaseMismatch,
        skipped: contribution.skipped,
        skipReason: contribution.skipReason
      } satisfies MinimumBalanceTrendLotDebugRow;
    });

    const includedRows = rows.filter((row) => !row.skipped && row.minimumExpectedUsed !== null && row.comparableValue !== null);
    const comparableTotal = includedRows.reduce((sum, row) => sum + (row.comparableValue ?? 0), 0);
    const minimumExpectedTotal = includedRows.reduce((sum, row) => sum + (row.minimumExpectedUsed ?? 0), 0);
    const balanceVsMinimumARS = comparableTotal - minimumExpectedTotal;
    const balanceVsMinimumPercent = minimumExpectedTotal > 0 ? ((comparableTotal / minimumExpectedTotal) - 1) * 100 : null;

    return {
      date: this.debugDateKey(date) ?? date.toISOString().slice(0, 10),
      benchmarkSourceSelected: benchmarkSelection.source,
      benchmarkSourcesAvailable: benchmarkSelection.availableSources,
      totals: {
        comparableValueARS: comparableTotal,
        minimumExpectedARS: minimumExpectedTotal,
        balanceVsMinimumARS,
        balanceVsMinimumPercent,
        includedLots: includedRows.length,
        skippedLots: rows.length - includedRows.length
      },
      lots: rows,
      warnings: this.uniqueWarnings([...benchmarkSelection.notes, ...warnings])
    };
  }

  private buildPointForDate(args: {
    date: Date;
    lots: HistoricalLot[];
    operations: InvestmentOperation[];
    sales: InvestmentSale[];
    priceIndex: Map<string, HistoricalPrice[]>;
    benchmarkRows: CalendarBenchmarkRow[];
    movementsIndex: Map<string, InvestmentMovement[]>;
    fciSymbols: Set<string>;
    warnings: string[];
  }): MinimumBalanceTrendPoint | null {
    const { date, lots, operations, sales, priceIndex, benchmarkRows, movementsIndex, fciSymbols, warnings } = args;
    const activeLots = lots.filter((lot) => this.isLotActiveAtDate(lot, date));
    if (!activeLots.length) {
      return null;
    }

    const movementTotalsByLot = this.buildMovementTotalsByLot(activeLots, movementsIndex, date, warnings);
    const fciCapitalBaseBySymbol = this.buildFciCapitalBaseBySymbol(operations, sales, date, fciSymbols);
    const fciSegmentBySymbol = this.buildFciHistoricalSegmentContextBySymbol(priceIndex, date, fciSymbols);
    const activeLotsBySymbol = new Map<string, HistoricalLot[]>();
    for (const lot of activeLots) {
      const bucket = activeLotsBySymbol.get(lot.symbol) ?? [];
      bucket.push(lot);
      activeLotsBySymbol.set(lot.symbol, bucket);
    }

    let comparableTotal = 0;
    let minimumExpectedTotal = 0;
    let includedLots = 0;

    for (const symbolLots of activeLotsBySymbol.values()) {
      const instrumentKind = this.resolveHistoricalInstrumentKind(symbolLots, fciSymbols);
      if (instrumentKind === 'fci' || instrumentKind === 'caucion') {
        const baseInfo = instrumentKind === 'fci' ? fciCapitalBaseBySymbol.get(symbolLots[0]?.symbol ?? '') ?? null : null;
        const segmentInfo = instrumentKind === 'fci' ? fciSegmentBySymbol.get(symbolLots[0]?.symbol ?? '') ?? null : null;
        const consolidated = this.buildConsolidatedHistoricalLot(symbolLots, date, instrumentKind as 'fci' | 'caucion');
        if (!consolidated) {
          warnings.push(
            instrumentKind === 'fci'
              ? `FCI omitido: ${symbolLots[0]?.symbol ?? 'N/D'} no tiene base activa en Tabla6 para ${this.formatDate(date)}.`
              : `Caucion omitida: ${symbolLots[0]?.symbol ?? 'N/D'} no tiene base activa en Tabla6 para ${this.formatDate(date)}.`
          );
          continue;
        }

        const resolvedFciBaseCapital =
          instrumentKind === 'fci'
            ? (segmentInfo?.baseCapital && segmentInfo.baseCapital > 0
                ? segmentInfo.baseCapital
                : baseInfo?.netAmount && baseInfo.netAmount > 0
                  ? baseInfo.netAmount
                  : this.priceAtOrBeforeInfo(priceIndex, consolidated.symbol, date).price)
            : null;

        const contribution = this.buildHistoricalLotContribution({
          lot:
            instrumentKind === 'fci' && (resolvedFciBaseCapital ?? 0) > 0
              ? {
                  ...consolidated,
                  investedAmount: resolvedFciBaseCapital
                }
              : consolidated,
          date,
          priceIndex,
          benchmarkRows,
          movementTotalsByLot,
          warnings,
          marketValueRule: instrumentKind === 'fci' ? 'fci-direct-value' : 'caucion-quantity',
          investedAmountOverride: instrumentKind === 'fci' ? resolvedFciBaseCapital ?? undefined : undefined,
          baseCapitalInfo: instrumentKind === 'fci' ? baseInfo : null,
          fciSegmentContext: instrumentKind === 'fci' ? segmentInfo : null
        });

        if (!contribution || contribution.skipped || contribution.minimumExpectedUsed === null || contribution.comparableValue === null) {
          continue;
        }

        comparableTotal += contribution.comparableValue;
        minimumExpectedTotal += contribution.minimumExpectedUsed;
        includedLots += 1;
        continue;
      }

      for (const lot of symbolLots) {
        const contribution = this.buildHistoricalLotContribution({
          lot,
          date,
          priceIndex,
          benchmarkRows,
          movementTotalsByLot,
          warnings,
          marketValueRule: 'standard'
        });

        if (!contribution || contribution.skipped || contribution.minimumExpectedUsed === null || contribution.comparableValue === null) {
          continue;
        }

        comparableTotal += contribution.comparableValue;
        minimumExpectedTotal += contribution.minimumExpectedUsed;
        includedLots += 1;
      }
    }

    if (!includedLots || minimumExpectedTotal <= 0) {
      return null;
    }

    const balanceVsMinimumARS = comparableTotal - minimumExpectedTotal;
    const balanceVsMinimumPercent = ((comparableTotal / minimumExpectedTotal) - 1) * 100;

    return {
      date,
      comparableValueARS: comparableTotal,
      minimumExpectedARS: minimumExpectedTotal,
      balanceVsMinimumARS,
      balanceVsMinimumPercent
    };
  }

  private benchmarkIndexInfo(
    rows: CalendarBenchmarkRow[],
    date: Date
  ): { index: number | null; row: CalendarBenchmarkRow | null; beforeStart: boolean; afterEnd: boolean } {
    if (!rows.length) {
      return { index: null, row: null, beforeStart: false, afterEnd: false };
    }

    const target = date.getTime();
    const first = rows[0];
    const last = rows[rows.length - 1];

    if (target < first.date.getTime()) {
      return { index: first.index, row: first, beforeStart: true, afterEnd: false };
    }

    if (target > last.date.getTime()) {
      return { index: last.index, row: last, beforeStart: false, afterEnd: true };
    }

    let candidate = first;
    for (const row of rows) {
      if (row.date.getTime() <= target) {
        candidate = row;
        continue;
      }
      break;
    }

    return { index: candidate.index, row: candidate, beforeStart: false, afterEnd: false };
  }

  private buildMovementTotalsByLot(
    activeLots: HistoricalLot[],
    movementsIndex: Map<string, InvestmentMovement[]>,
    evalDate: Date,
    warnings: string[]
  ): Map<string, HistoricalLotMovementTotals> {
    const totals = new Map<string, HistoricalLotMovementTotals>();
    const lotsBySymbol = new Map<string, HistoricalLot[]>();

    for (const lot of activeLots) {
      const bucket = lotsBySymbol.get(lot.symbol) ?? [];
      bucket.push(lot);
      lotsBySymbol.set(lot.symbol, bucket);
    }

    for (const [symbol, movements] of movementsIndex.entries()) {
      const symbolLots = lotsBySymbol.get(symbol) ?? [];
      if (!symbolLots.length) {
        continue;
      }

      for (const movement of movements) {
        const movementDate = movement.date ?? null;
        const movementAmount = movement.amount ?? null;
        if (!movementDate || movementDate.getTime() > evalDate.getTime() || movementAmount === null) {
          continue;
        }

        const eligibleLots = symbolLots.filter(
          (lot) =>
            this.isLotActiveAtDate(lot, movementDate) &&
            this.isCurrencyCompatible(lot.currency, movement.currency)
        );
        const totalQuantity = eligibleLots.reduce((sum, lot) => sum + Math.max(0, lot.quantity ?? 0), 0);
        if (totalQuantity <= 0) {
          continue;
        }

        for (const lot of eligibleLots) {
          const share = Math.max(0, lot.quantity ?? 0) / totalQuantity;
          const assignedAmount = movementAmount * share;
          const bucket = totals.get(lot.id) ?? {
            incomeAmount: 0,
            capitalReturnedAmount: 0,
            amortizations: [],
            appliedMovements: []
          };

          bucket.appliedMovements.push({
            date: movementDate,
            type: movement.type,
            amount: movementAmount,
            affectsPerformance: movement.affectsPerformance,
            affectsInvestedCapital: movement.affectsInvestedCapital,
            capitalEffect: movement.capitalEffect,
            assignedAmount,
            note: movement.note
          });

          if (movement.affectsPerformance) {
            bucket.incomeAmount += assignedAmount;
          }

          if (movement.affectsInvestedCapital && movement.capitalEffect === 'reduces-cost') {
            bucket.capitalReturnedAmount += assignedAmount;
            bucket.amortizations.push({
              date: movementDate,
              amount: assignedAmount
            });
          }

          totals.set(lot.id, bucket);
        }
      }
    }

    return totals;
  }

  private buildHistoricalLotContribution(args: {
    lot: HistoricalLot;
    date: Date;
    priceIndex: Map<string, HistoricalPrice[]>;
    benchmarkRows: CalendarBenchmarkRow[];
    movementTotalsByLot: Map<string, HistoricalLotMovementTotals>;
    warnings: string[];
    marketValueRule: 'standard' | 'fci-direct-value' | 'caucion-quantity';
    investedAmountOverride?: number | null;
    baseCapitalInfo?: FciCapitalBaseInfo | null;
    fciSegmentContext?: FciHistoricalSegmentContext | null;
  }): HistoricalLotContribution {
    const { lot, date, priceIndex, benchmarkRows, movementTotalsByLot, warnings, marketValueRule, investedAmountOverride, baseCapitalInfo, fciSegmentContext } = args;

    const emptyResult = (skipReason: string, historicalPrice: number | null = null, marketValue: number | null = null): HistoricalLotContribution => ({
      marketValueRule,
      historicalPrice,
      historicalPriceDate: null,
      marketValue,
      benchmarkSource: null,
      buyBenchmarkSource: null,
      evalBenchmarkSource: null,
      buyIndex: null,
      buyIndexDate: null,
      evalIndex: null,
      evalIndexDate: null,
      benchmarkRatio: null,
      rawMinimumExpected: null,
      adjustedMinimumExpected: null,
      minimumExpectedUsed: null,
      incomeAmount: 0,
      capitalReturnedAmount: 0,
      comparableValue: null,
      balanceVsMinimum: null,
      balanceVsMinimumPercent: null,
      impactScore: 0,
      movements: [],
      fciCapitalReturnedAmount: null,
      baseCapitalUsed: null,
      baseCapitalRule: null,
      baseCapitalSource: null,
      baseCapitalPurchaseAmount: null,
      baseCapitalSoldAmount: null,
      baseCapitalNetAmount: null,
      baseDate: null,
      possibleBaseMismatch: false,
      fciSegmentStartDate: null,
      fciSegmentBaseCapital: null,
      fciSegmentResetReason: null,
      fciSegmentThreshold: null,
      fciCapitalEvents: [],
      skipped: true,
      skipReason
    });

    if (lot.currency !== 'ARS') {
      return emptyResult('unsupported-currency');
    }

    if (!this.isLotActiveAtDate(lot, date)) {
      return emptyResult('lot-not-active-at-date');
    }

    if (marketValueRule === 'standard' && this.isNonComparableHistoricalInstrument(lot.symbol)) {
      warnings.push(`Instrumento no comparable omitido en historico: ${lot.symbol}. No se reconstruye por cantidad * precio.`);
      return emptyResult('non-comparable-instrument');
    }

    const historicalPriceInfo = this.priceAtOrBeforeInfo(priceIndex, lot.symbol, date);
    if (marketValueRule === 'standard' && historicalPriceInfo.price === null) {
      warnings.push(`No hay precio historico disponible para ${lot.symbol} antes de ${this.formatDate(date)}. Lote omitido en ese punto.`);
      return emptyResult('missing-historical-price');
    }
    if (marketValueRule === 'fci-direct-value' && historicalPriceInfo.price === null) {
      warnings.push(`No hay valor historico disponible en Tabla5 para ${lot.symbol} antes de ${this.formatDate(date)}. FCI omitido en ese punto.`);
      return emptyResult('missing-fci-historical-price');
    }

    const benchmarkStartDate =
      marketValueRule === 'fci-direct-value'
        ? (fciSegmentContext?.baseDate ?? baseCapitalInfo?.baseDate ?? lot.buyDate ?? date)
        : (baseCapitalInfo?.baseDate ?? lot.buyDate ?? date);
    const benchmarkStart = this.benchmarkIndexInfo(benchmarkRows, benchmarkStartDate);
    const benchmarkEnd = this.benchmarkIndexInfo(benchmarkRows, date);
    if (benchmarkStart.index === null || benchmarkEnd.index === null || benchmarkStart.index <= 0 || benchmarkEnd.index <= 0) {
      warnings.push(`No se pudo calcular el benchmark para ${lot.symbol} en ${this.formatDate(date)}.`);
      return {
        ...emptyResult('missing-benchmark-index', historicalPriceInfo.price, null),
        historicalPriceDate: historicalPriceInfo.date,
        benchmarkSource: this.debugBenchmarkSourceLabel(benchmarkStart.row, benchmarkEnd.row),
        buyBenchmarkSource: benchmarkStart.row?.source ?? null,
        evalBenchmarkSource: benchmarkEnd.row?.source ?? null,
        buyIndex: benchmarkStart.index,
        buyIndexDate: benchmarkStart.row?.date ?? null,
        evalIndex: benchmarkEnd.index,
        evalIndexDate: benchmarkEnd.row?.date ?? null,
        benchmarkRatio: benchmarkStart.index && benchmarkEnd.index ? benchmarkEnd.index / benchmarkStart.index : null
      };
    }

    const lotMovements = movementTotalsByLot.get(lot.id) ?? {
      incomeAmount: 0,
      capitalReturnedAmount: 0,
      amortizations: [],
      appliedMovements: []
    };

    const fciReductionContext =
      marketValueRule === 'fci-direct-value'
        ? this.buildFciMinimumExpectedWithCapitalReductions({
            benchmarkRows,
            date,
            baseInfo: baseCapitalInfo ?? null,
            warnings,
            fallbackBaseCapital:
              investedAmountOverride && investedAmountOverride > 0
                ? investedAmountOverride
                : lot.investedAmount && lot.investedAmount > 0
                  ? lot.investedAmount
                  : historicalPriceInfo.price
          })
        : null;

    let marketValue: number | null = null;
    if (marketValueRule === 'fci-direct-value') {
      marketValue = historicalPriceInfo.price;
    } else if (marketValueRule === 'caucion-quantity') {
      marketValue = Math.max(0, lot.quantity ?? 0);
    } else {
      marketValue = (lot.quantity ?? 0) * (historicalPriceInfo.price ?? 0);
      if (lot.investedAmount !== null && lot.investedAmount > 0 && marketValue > lot.investedAmount * 100) {
        warnings.push(
          `Valor historico sospechoso para ${lot.symbol}: marketValue muy superior al capital invertido. Revisar escala de precio/cantidad.`
        );
        return {
          ...emptyResult('suspicious-scale', historicalPriceInfo.price, marketValue),
          historicalPriceDate: historicalPriceInfo.date
        };
      }
    }

    if (marketValue === null || !Number.isFinite(marketValue)) {
      return {
        ...emptyResult('missing-market-value', historicalPriceInfo.price, null),
        historicalPriceDate: historicalPriceInfo.date
      };
    }

    const resolvedInvestedAmount =
      marketValueRule === 'fci-direct-value'
        ? (fciReductionContext?.baseCapitalInitial && fciReductionContext.baseCapitalInitial > 0
            ? fciReductionContext.baseCapitalInitial
            : fciSegmentContext?.baseCapital && fciSegmentContext.baseCapital > 0
              ? fciSegmentContext.baseCapital
              : investedAmountOverride && investedAmountOverride > 0
                ? investedAmountOverride
                : lot.investedAmount && lot.investedAmount > 0
                  ? lot.investedAmount
                  : historicalPriceInfo.price)
        : investedAmountOverride ?? lot.investedAmount ?? lot.quantity ?? null;
    const investedAmount = resolvedInvestedAmount;
    if (investedAmount === null || investedAmount <= 0) {
      return {
        ...emptyResult('missing-invested-amount', historicalPriceInfo.price, marketValue),
        historicalPriceDate: historicalPriceInfo.date
      };
    }

    const comparableValue = marketValue + lotMovements.incomeAmount + lotMovements.capitalReturnedAmount;
    const adjustedBenchmark =
      marketValueRule === 'fci-direct-value'
        ? null
        : this.buildAmortizationAdjustedBenchmark(
            investedAmount,
            benchmarkStart.index,
            benchmarkEnd.index,
            benchmarkRows,
            lotMovements.amortizations,
            warnings
          );
    const fciMinimumExpected = marketValueRule === 'fci-direct-value' ? fciReductionContext : null;
    const rawMinimumExpected =
      marketValueRule === 'fci-direct-value'
        ? fciMinimumExpected?.minimumExpectedUsed ?? null
        : investedAmount * (benchmarkEnd.index / benchmarkStart.index);
    const minimumExpectedUsed =
      marketValueRule === 'fci-direct-value'
        ? fciMinimumExpected?.minimumExpectedUsed ?? null
        : adjustedBenchmark?.usesAdjustedBenchmark
          ? adjustedBenchmark.minimumExpectedValueAdjusted
          : rawMinimumExpected;

    if (minimumExpectedUsed === null || !Number.isFinite(minimumExpectedUsed)) {
      warnings.push(`No se pudo calcular el minimo esperado para ${lot.symbol} en ${this.formatDate(date)}.`);
      return {
        ...emptyResult('missing-minimum-expected', historicalPriceInfo.price, marketValue),
        historicalPriceDate: historicalPriceInfo.date,
        benchmarkSource: this.debugBenchmarkSourceLabel(benchmarkStart.row, benchmarkEnd.row),
        buyBenchmarkSource: benchmarkStart.row?.source ?? null,
        evalBenchmarkSource: benchmarkEnd.row?.source ?? null,
        buyIndex: benchmarkStart.index,
        buyIndexDate: benchmarkStart.row?.date ?? null,
        evalIndex: benchmarkEnd.index,
        evalIndexDate: benchmarkEnd.row?.date ?? null,
        benchmarkRatio: benchmarkStart.index && benchmarkEnd.index ? benchmarkEnd.index / benchmarkStart.index : null,
        rawMinimumExpected,
        adjustedMinimumExpected: adjustedBenchmark?.usesAdjustedBenchmark ? adjustedBenchmark.minimumExpectedValueAdjusted : null,
        incomeAmount: lotMovements.incomeAmount,
        capitalReturnedAmount: lotMovements.capitalReturnedAmount,
        comparableValue,
        fciCapitalReturnedAmount: fciMinimumExpected?.capitalReturnedAmount ?? null,
        capitalOriginalReconstruido: fciReductionContext?.capitalOriginalReconstruido ?? null,
        capitalExpuestoCosto: fciReductionContext?.capitalExpuestoCosto ?? null,
        ventasOriginalCostTotales: baseCapitalInfo?.soldAmount ?? 0,
        ventasOriginalCostHastaFecha: fciReductionContext?.ventasOriginalCostHastaFecha ?? 0,
        ventasProceedsHastaFecha: fciReductionContext?.ventasProceedsHastaFecha ?? 0,
        realizedGainHastaFecha: fciReductionContext?.realizedGainHastaFecha ?? 0,
        baseCapitalUsed: investedAmount,
        baseCapitalRule: marketValueRule === 'fci-direct-value'
          ? fciReductionContext
            ? 'fci-capital-events'
            : fciSegmentContext
              ? 'fci-historical-segment-base'
              : baseCapitalInfo
                ? 'fci-net-historical-capital'
                : 'fci-fallback-market-value'
          : marketValueRule === 'caucion-quantity'
            ? 'caucion-quantity'
            : 'lot-invested-amount',
        baseCapitalSource: marketValueRule === 'fci-direct-value'
          ? fciReductionContext
            ? 'Tabla6+Tabla13 eventos históricos'
            : fciSegmentContext
              ? 'Tabla5 segmento histórico'
              : baseCapitalInfo
                ? 'Tabla6+Tabla13 neto histórico'
                : 'Tabla5 valor histórico'
          : marketValueRule === 'caucion-quantity'
            ? 'cantidad'
            : 'lote',
        baseCapitalPurchaseAmount: baseCapitalInfo?.purchaseAmount ?? null,
        baseCapitalSoldAmount: baseCapitalInfo?.soldAmount ?? null,
        baseCapitalNetAmount: baseCapitalInfo?.netAmount ?? null,
        baseDate: marketValueRule === 'fci-direct-value'
          ? (fciReductionContext?.baseDate ?? fciSegmentContext?.baseDate ?? benchmarkStartDate)
          : benchmarkStartDate,
        possibleBaseMismatch: false,
        fciSegmentStartDate: fciSegmentContext?.baseDate ?? null,
        fciSegmentBaseCapital: fciSegmentContext?.baseCapital ?? null,
        fciSegmentResetReason: fciSegmentContext?.resetReason ?? null,
        fciSegmentThreshold: fciSegmentContext?.threshold ?? null,
        benchmarkStartDate: fciReductionContext?.benchmarkStartDate ?? benchmarkStart.row?.date ?? null,
        benchmarkEndDate: fciReductionContext?.benchmarkEndDate ?? benchmarkEnd.row?.date ?? null,
        fciCapitalEvents: fciReductionContext?.fciCapitalEvents ?? []
      };
    }

    const balanceVsMinimum = comparableValue - minimumExpectedUsed;
    const balanceVsMinimumPercent = minimumExpectedUsed > 0 ? ((comparableValue / minimumExpectedUsed) - 1) * 100 : null;
    const impactScore = this.debugImpactScore({
      balanceVsMinimum,
      minimumExpectedUsed,
      comparableValue,
      marketValue,
      capitalReturnedAmount: lotMovements.capitalReturnedAmount,
      incomeAmount: lotMovements.incomeAmount
    });

    const possibleBaseMismatch =
      marketValueRule === 'fci-direct-value' && investedAmount > 0 && marketValue !== null ? marketValue / investedAmount > 2 : false;
    if (possibleBaseMismatch) {
      warnings.push(
        `FCI con base de mínimo inconsistente: el valor historico supera ampliamente el mínimo esperado para ${lot.symbol}. Revisar baseCapitalFci.`
      );
    }

    return {
      marketValueRule,
      historicalPrice: historicalPriceInfo.price,
      historicalPriceDate: historicalPriceInfo.date,
      marketValue,
      benchmarkSource: this.debugBenchmarkSourceLabel(benchmarkStart.row, benchmarkEnd.row),
      buyBenchmarkSource: benchmarkStart.row?.source ?? null,
      evalBenchmarkSource: benchmarkEnd.row?.source ?? null,
      buyIndex: benchmarkStart.index,
      buyIndexDate: benchmarkStart.row?.date ?? null,
      evalIndex: benchmarkEnd.index,
      evalIndexDate: benchmarkEnd.row?.date ?? null,
      benchmarkRatio: benchmarkStart.index && benchmarkEnd.index ? benchmarkEnd.index / benchmarkStart.index : null,
      rawMinimumExpected,
      adjustedMinimumExpected: adjustedBenchmark?.usesAdjustedBenchmark ? adjustedBenchmark.minimumExpectedValueAdjusted : null,
      minimumExpectedUsed,
      incomeAmount: lotMovements.incomeAmount,
      capitalReturnedAmount: lotMovements.capitalReturnedAmount,
      comparableValue,
      balanceVsMinimum,
      balanceVsMinimumPercent,
      impactScore,
      movements: lotMovements.appliedMovements,
      fciCapitalReturnedAmount: marketValueRule === 'fci-direct-value' ? fciReductionContext?.capitalReturnedAmount ?? null : null,
      capitalOriginalReconstruido: marketValueRule === 'fci-direct-value' ? fciReductionContext?.capitalOriginalReconstruido ?? null : null,
      capitalExpuestoCosto: marketValueRule === 'fci-direct-value' ? fciReductionContext?.capitalExpuestoCosto ?? null : null,
      ventasOriginalCostTotales: marketValueRule === 'fci-direct-value' ? baseCapitalInfo?.soldAmount ?? 0 : null,
      ventasOriginalCostHastaFecha: marketValueRule === 'fci-direct-value' ? fciReductionContext?.ventasOriginalCostHastaFecha ?? 0 : null,
      ventasProceedsHastaFecha: marketValueRule === 'fci-direct-value' ? fciReductionContext?.ventasProceedsHastaFecha ?? 0 : null,
      realizedGainHastaFecha: marketValueRule === 'fci-direct-value' ? fciReductionContext?.realizedGainHastaFecha ?? 0 : null,
      baseCapitalUsed: investedAmount,
      baseCapitalRule: marketValueRule === 'fci-direct-value'
        ? fciReductionContext
          ? 'fci-capital-events'
          : fciSegmentContext
            ? 'fci-historical-segment-base'
            : baseCapitalInfo
              ? 'fci-net-historical-capital'
              : 'fci-fallback-market-value'
        : marketValueRule === 'caucion-quantity'
          ? 'caucion-quantity'
          : 'lot-invested-amount',
      baseCapitalSource: marketValueRule === 'fci-direct-value'
        ? fciReductionContext
          ? 'Tabla6+Tabla13 eventos históricos'
          : fciSegmentContext
            ? 'Tabla5 segmento histórico'
            : baseCapitalInfo
              ? 'Tabla6+Tabla13 neto histórico'
              : 'Tabla5 valor histórico'
        : marketValueRule === 'caucion-quantity'
          ? 'cantidad'
          : 'lote',
      baseCapitalPurchaseAmount: baseCapitalInfo?.purchaseAmount ?? null,
      baseCapitalSoldAmount: baseCapitalInfo?.soldAmount ?? null,
      baseCapitalNetAmount: baseCapitalInfo?.netAmount ?? null,
      baseDate: marketValueRule === 'fci-direct-value'
        ? (fciReductionContext?.baseDate ?? fciSegmentContext?.baseDate ?? benchmarkStartDate)
        : benchmarkStartDate,
      possibleBaseMismatch,
      fciSegmentStartDate: fciSegmentContext?.baseDate ?? null,
      fciSegmentBaseCapital: fciSegmentContext?.baseCapital ?? null,
      fciSegmentResetReason: fciSegmentContext?.resetReason ?? null,
      fciSegmentThreshold: fciSegmentContext?.threshold ?? null,
      benchmarkStartDate: marketValueRule === 'fci-direct-value' ? (fciReductionContext?.benchmarkStartDate ?? benchmarkStart.row?.date ?? null) : benchmarkStart.row?.date ?? null,
      benchmarkEndDate: marketValueRule === 'fci-direct-value' ? (fciReductionContext?.benchmarkEndDate ?? benchmarkEnd.row?.date ?? null) : benchmarkEnd.row?.date ?? null,
      fciCapitalEvents: marketValueRule === 'fci-direct-value' ? fciReductionContext?.fciCapitalEvents ?? [] : [],
      skipped: false,
      skipReason: null
    };
  }

  private pickHistoricalRepresentativeLot(lots: HistoricalLot[], date: Date): HistoricalLot | null {
    const activeTabla6Lots = lots.filter((lot) => lot.sourceTable === 'Tabla6' && this.isLotActiveAtDate(lot, date));
    if (activeTabla6Lots.length) {
      return activeTabla6Lots.reduce((winner, current) => {
        if (!winner) {
          return current;
        }
        const winnerAmount = winner.investedAmount ?? 0;
        const currentAmount = current.investedAmount ?? 0;
        return currentAmount > winnerAmount ? current : winner;
      }, activeTabla6Lots[0]) ?? null;
    }
    return null;
  }

  private buildConsolidatedHistoricalLot(
    lots: HistoricalLot[],
    date: Date,
    instrumentKind: 'fci' | 'caucion'
  ): HistoricalLot | null {
    const activeLots =
      instrumentKind === 'fci'
        ? lots.filter((lot) => lot.sourceTable === 'Tabla6' && this.isLotActiveAtDate(lot, date))
        : lots.filter((lot) => this.isLotActiveAtDate(lot, date));

    if (!activeLots.length) {
      return null;
    }

    const quantity = activeLots.reduce((sum, lot) => sum + Math.max(0, lot.quantity ?? 0), 0);
    const investedAmount = activeLots.reduce((sum, lot) => sum + Math.max(0, lot.investedAmount ?? 0), 0);
    const buyDates = activeLots.map((lot) => lot.buyDate).filter((value): value is Date => Boolean(value));
    const sellDates = activeLots.map((lot) => lot.sellDate).filter((value): value is Date => Boolean(value));

    return {
      ...activeLots[0],
      quantity,
      investedAmount,
      buyDate: buyDates.length ? new Date(Math.min(...buyDates.map((value) => value.getTime()))) : activeLots[0].buyDate,
      sellDate: sellDates.length ? new Date(Math.max(...sellDates.map((value) => value.getTime()))) : activeLots[0].sellDate,
      instrumentKind,
      fciSource: instrumentKind === 'fci' ? activeLots[0].fciSource : null
    };
  }

  private buildFciCapitalBaseBySymbol(
    operations: InvestmentOperation[],
    sales: InvestmentSale[],
    date: Date,
    fciSymbols: Set<string>
  ): Map<string, FciCapitalBaseInfo> {
    const grouped = new Map<string, FciCapitalBaseInfo>();

    const addPurchase = (symbol: string, amount: number, opDate: Date, id: string) => {
      const current = grouped.get(symbol) ?? {
        purchaseAmount: 0,
        soldAmount: 0,
        netAmount: 0,
        baseDate: null,
        purchaseLotIds: [],
        soldLotIds: [],
        capitalEvents: []
      };

      current.purchaseAmount += amount;
      current.netAmount += amount;
      current.baseDate = current.baseDate && current.baseDate.getTime() <= opDate.getTime() ? current.baseDate : opDate;
      current.purchaseLotIds.push(id);
      current.capitalEvents.push({
        date: opDate,
        type: 'buy',
        amount,
        originalCostAmount: amount,
        saleProceedsAmount: null,
        realizedGainAmount: null,
        sourceTable: 'Tabla6',
        sourceId: id,
        benchmarkIndexBeforeEvent: null,
        benchmarkIndexAtEvent: null,
        capitalBeforeEvent: 0,
        capitalAfterEvent: 0,
        benchmarkBalanceBeforeEvent: 0,
        benchmarkBalanceAfterEvent: 0,
        minimumAccruedBeforeEvent: 0,
        minimumAccruedAfterEvent: 0,
        soldShare: null,
        minimumExpectedRemoved: null
      });
      grouped.set(symbol, current);
    };

    const addSale = (
      symbol: string,
      amount: number,
      saleDate: Date,
      id: string,
      saleProceedsAmount: number | null,
      realizedGainAmount: number | null
    ) => {
      const current = grouped.get(symbol) ?? {
        purchaseAmount: 0,
        soldAmount: 0,
        netAmount: 0,
        baseDate: null,
        purchaseLotIds: [],
        soldLotIds: [],
        capitalEvents: []
      };

      current.soldAmount += amount;
      current.netAmount += amount;
      current.soldLotIds.push(id);
      current.baseDate = current.baseDate && current.baseDate.getTime() <= saleDate.getTime() ? current.baseDate : saleDate;
      current.capitalEvents.push({
        date: saleDate,
        type: 'sell',
        amount,
        originalCostAmount: amount,
        saleProceedsAmount,
        realizedGainAmount,
        sourceTable: 'Tabla13',
        sourceId: id,
        benchmarkIndexBeforeEvent: null,
        benchmarkIndexAtEvent: null,
        capitalBeforeEvent: 0,
        capitalAfterEvent: 0,
        benchmarkBalanceBeforeEvent: 0,
        benchmarkBalanceAfterEvent: 0,
        minimumAccruedBeforeEvent: 0,
        minimumAccruedAfterEvent: 0,
        soldShare: null,
        minimumExpectedRemoved: null
      });
      grouped.set(symbol, current);
    };

    for (const operation of operations) {
      const symbol = String(operation.symbol ?? '').trim().toUpperCase();
      if (!symbol || !fciSymbols.has(symbol)) {
        continue;
      }
      const opDate = this.asDate(operation.date);
      if (!opDate || opDate.getTime() > date.getTime()) {
        continue;
      }
      const amount = Math.max(0, this.asNumber(operation.total ?? operation.amount) ?? 0);
      if (amount <= 0) {
        continue;
      }
      addPurchase(symbol, amount, opDate, String(operation.id ?? '').trim() || `op-${symbol}-${opDate.toISOString()}`);
    }

    for (const sale of sales) {
      const symbol = String(sale.symbol ?? '').trim().toUpperCase();
      if (!symbol || !fciSymbols.has(symbol)) {
        continue;
      }
      const saleDate = this.asDate(sale.sellDate ?? sale.buyDate);
      if (!saleDate) {
        continue;
      }
      const amount = Math.max(0, this.asNumber(sale.total ?? sale.amount) ?? 0);
      if (amount <= 0) {
        continue;
      }
      const saleProceedsAmount =
        this.asNumber(sale.currentValue) ??
        (this.asNumber(sale.quantity) !== null && this.asNumber(sale.sellPrice) !== null
          ? (this.asNumber(sale.quantity) ?? 0) * (this.asNumber(sale.sellPrice) ?? 0)
          : null);
      const realizedGainAmount =
        saleProceedsAmount !== null && Number.isFinite(saleProceedsAmount)
          ? saleProceedsAmount - amount
          : this.asNumber(sale.amount);
      addSale(
        symbol,
        amount,
        saleDate,
        String(sale.id ?? '').trim() || `sale-${symbol}-${saleDate.toISOString()}`,
        saleProceedsAmount !== null && Number.isFinite(saleProceedsAmount) ? Math.max(0, saleProceedsAmount) : null,
        realizedGainAmount !== null && Number.isFinite(realizedGainAmount) ? realizedGainAmount : null
      );
    }

    for (const info of grouped.values()) {
      info.netAmount = Math.max(0, info.purchaseAmount + info.soldAmount);
      info.capitalEvents.sort((left, right) => {
        const diff = left.date.getTime() - right.date.getTime();
        if (diff !== 0) {
          return diff;
        }
        if (left.type === right.type) {
          return 0;
        }
        return left.type === 'buy' ? -1 : 1;
      });
    }

    return grouped;
  }

  private buildFciMinimumExpectedWithCapitalReductions(args: {
    benchmarkRows: CalendarBenchmarkRow[];
    date: Date;
    baseInfo: FciCapitalBaseInfo | null;
    warnings: string[];
    fallbackBaseCapital: number | null;
  }): {
    baseCapitalInitial: number | null;
    remainingExposedCapital: number | null;
    capitalReturnedAmount: number;
    capitalOriginalReconstruido: number | null;
    capitalExpuestoCosto: number | null;
    ventasOriginalCostTotales: number;
    ventasOriginalCostHastaFecha: number;
    ventasProceedsHastaFecha: number;
    realizedGainHastaFecha: number;
    benchmarkAccruedAmount: number | null;
    minimumExpectedUsed: number | null;
    benchmarkRatio: number | null;
    benchmarkStartDate: Date | null;
    benchmarkEndDate: Date | null;
    baseDate: Date | null;
    fciCapitalEvents: FciCapitalEvent[];
  } {
    const { benchmarkRows, date, baseInfo, warnings, fallbackBaseCapital } = args;
    const sortedEvents = [...(baseInfo?.capitalEvents ?? [])].sort((left, right) => {
      const diff = left.date.getTime() - right.date.getTime();
      if (diff !== 0) {
        return diff;
      }
      if (left.type === right.type) {
        return 0;
      }
      return left.type === 'buy' ? -1 : 1;
    });

    const reconstructedBaseCapital =
      baseInfo && baseInfo.netAmount > 0
        ? baseInfo.netAmount
        : fallbackBaseCapital !== null && fallbackBaseCapital > 0
          ? fallbackBaseCapital
          : null;
    const benchmarkStartDate = baseInfo?.baseDate ?? sortedEvents[0]?.date ?? null;
    const benchmarkStartInfo = benchmarkStartDate
      ? this.benchmarkIndexInfo(benchmarkRows, benchmarkStartDate)
      : { index: null, row: null, beforeStart: false, afterEnd: false };
    const evalBenchmarkInfo = this.benchmarkIndexInfo(benchmarkRows, date);

    if (!reconstructedBaseCapital || reconstructedBaseCapital <= 0) {
      return {
        baseCapitalInitial: null,
        remainingExposedCapital: null,
        capitalReturnedAmount: 0,
        capitalOriginalReconstruido: null,
        capitalExpuestoCosto: null,
        ventasOriginalCostTotales: baseInfo?.soldAmount ?? 0,
        ventasOriginalCostHastaFecha: 0,
        ventasProceedsHastaFecha: 0,
        realizedGainHastaFecha: 0,
        benchmarkAccruedAmount: null,
        minimumExpectedUsed: null,
        benchmarkRatio: null,
        benchmarkStartDate,
        benchmarkEndDate: evalBenchmarkInfo.row?.date ?? null,
        baseDate: benchmarkStartDate,
        fciCapitalEvents: []
      };
    }

    const saleEvents = sortedEvents.filter((event) => event.type === 'sell');
    let capital = reconstructedBaseCapital;
    let benchmarkBalance = reconstructedBaseCapital;
    let lastBenchmarkIndex: number | null = benchmarkStartInfo.index && benchmarkStartInfo.index > 0 ? benchmarkStartInfo.index : null;
    let baseDate = benchmarkStartDate;
    let capitalReturnedAmount = 0;
    let firstBenchmarkIndex: number | null = benchmarkStartInfo.index && benchmarkStartInfo.index > 0 ? benchmarkStartInfo.index : null;

    for (const event of saleEvents) {
      if (event.date.getTime() > date.getTime()) {
        continue;
      }

      const benchmarkInfo = this.benchmarkIndexInfo(benchmarkRows, event.date);
      if (benchmarkInfo.index === null || benchmarkInfo.index <= 0) {
        continue;
      }

      const benchmarkIndexBeforeEvent = lastBenchmarkIndex;
      if (lastBenchmarkIndex === null) {
        lastBenchmarkIndex = benchmarkInfo.index;
        baseDate = benchmarkInfo.row?.date ?? event.date;
        firstBenchmarkIndex = benchmarkInfo.index;
      } else if (lastBenchmarkIndex > 0) {
        benchmarkBalance = benchmarkBalance * (benchmarkInfo.index / lastBenchmarkIndex);
        lastBenchmarkIndex = benchmarkInfo.index;
      }

      const capitalBeforeEvent = capital;
      const minimumAccruedBeforeEvent = benchmarkBalance;
      let soldShare = 1;
      if (capitalBeforeEvent > 0) {
        soldShare = Math.max(0, Math.min(1, event.amount / capitalBeforeEvent));
        if (event.amount > capitalBeforeEvent) {
          warnings.push(`Venta FCI supera el capital expuesto antes del evento para ${baseInfo?.purchaseLotIds[0] ?? 'FCI'}.`);
        }
      } else {
        warnings.push(`Venta FCI supera o agota el capital expuesto antes del evento para ${baseInfo?.purchaseLotIds[0] ?? 'FCI'}.`);
      }
      const minimumExpectedRemoved = minimumAccruedBeforeEvent * soldShare;
      capital = Math.max(0, capitalBeforeEvent - event.amount);
      benchmarkBalance = Math.max(0, minimumAccruedBeforeEvent - minimumExpectedRemoved);
      capitalReturnedAmount += event.amount;

      event.benchmarkIndexBeforeEvent = benchmarkIndexBeforeEvent;
      event.benchmarkIndexAtEvent = benchmarkInfo.index;
      event.capitalBeforeEvent = capitalBeforeEvent;
      event.capitalAfterEvent = capital;
      event.benchmarkBalanceBeforeEvent = minimumAccruedBeforeEvent;
      event.benchmarkBalanceAfterEvent = benchmarkBalance;
      event.minimumAccruedBeforeEvent = minimumAccruedBeforeEvent;
      event.minimumAccruedAfterEvent = benchmarkBalance;
      event.soldShare = soldShare;
      event.minimumExpectedRemoved = minimumExpectedRemoved;
    }

    if (evalBenchmarkInfo.index !== null && evalBenchmarkInfo.index > 0 && lastBenchmarkIndex !== null && lastBenchmarkIndex > 0) {
      benchmarkBalance = benchmarkBalance * (evalBenchmarkInfo.index / lastBenchmarkIndex);
    }

    const benchmarkRatio =
      firstBenchmarkIndex !== null && firstBenchmarkIndex > 0 && evalBenchmarkInfo.index !== null && evalBenchmarkInfo.index > 0
        ? evalBenchmarkInfo.index / firstBenchmarkIndex
        : null;

    return {
      baseCapitalInitial: reconstructedBaseCapital,
      remainingExposedCapital: capital,
      capitalReturnedAmount,
      capitalOriginalReconstruido: reconstructedBaseCapital,
      capitalExpuestoCosto: capital,
      ventasOriginalCostTotales: baseInfo?.soldAmount ?? 0,
      ventasOriginalCostHastaFecha: capitalReturnedAmount,
      ventasProceedsHastaFecha: saleEvents
        .filter((event) => event.date.getTime() <= date.getTime())
        .reduce((sum, event) => sum + (event.saleProceedsAmount ?? 0), 0),
      realizedGainHastaFecha: saleEvents
        .filter((event) => event.date.getTime() <= date.getTime())
        .reduce((sum, event) => sum + (event.realizedGainAmount ?? 0), 0),
      benchmarkAccruedAmount: benchmarkBalance,
      minimumExpectedUsed: benchmarkBalance,
      benchmarkRatio,
      benchmarkStartDate: benchmarkStartInfo.row?.date ?? benchmarkStartDate,
      benchmarkEndDate: evalBenchmarkInfo.row?.date ?? null,
      baseDate,
      fciCapitalEvents: sortedEvents
    };
  }

  private buildFciHistoricalSegmentContextBySymbol(
    priceIndex: Map<string, HistoricalPrice[]>,
    date: Date,
    fciSymbols: Set<string>
  ): Map<string, FciHistoricalSegmentContext> {
    const result = new Map<string, FciHistoricalSegmentContext>();

    for (const symbol of fciSymbols) {
      const prices = (priceIndex.get(symbol) ?? [])
        .map((price) => {
          const priceDate = this.asDate(price.date);
          const priceValue = typeof price.price === 'number' && Number.isFinite(price.price) ? price.price : null;
          return priceDate && priceValue !== null ? { date: priceDate, price: priceValue } : null;
        })
        .filter((price): price is { date: Date; price: number } => !!price && price.date.getTime() <= date.getTime())
        .sort((left, right) => left.date.getTime() - right.date.getTime());

      if (!prices.length) {
        continue;
      }

      let segmentStart = prices[0];
      let resetReason: string | null = 'first-fci-value';
      let currentMarketValue = prices[0].price;
      let currentMarketValueDate = new Date(prices[0].date);

      for (let index = 1; index < prices.length; index += 1) {
        const previous = prices[index - 1];
        const current = prices[index];
        currentMarketValue = current.price;
        currentMarketValueDate = new Date(current.date);

        const previousPrice = Math.max(Math.abs(previous.price), 1);
        const deltaRatio = Math.abs(current.price - previous.price) / previousPrice;
        if (deltaRatio > FCI_EXPOSURE_RESET_THRESHOLD) {
          segmentStart = current;
          resetReason = current.price >= previous.price ? 'fci-exposure-reset-up' : 'fci-exposure-reset-down';
        }
      }

      result.set(symbol, {
        symbol,
        baseDate: segmentStart.date ? new Date(segmentStart.date) : null,
        baseCapital: Number.isFinite(segmentStart.price) ? segmentStart.price : null,
        resetReason,
        threshold: FCI_EXPOSURE_RESET_THRESHOLD,
        marketValue: currentMarketValue,
        marketValueDate: currentMarketValueDate
      });
    }

    return result;
  }

  private resolveHistoricalInstrumentKind(lots: HistoricalLot[], fciSymbols: Set<string>): 'standard' | 'fci' | 'caucion' {
    const symbol = lots[0]?.symbol ?? '';
    if (lots.some((lot) => lot.instrumentKind === 'fci') || this.isFciHistoricalSymbol(symbol, lots[0]?.positionType ?? null, lots[0]?.assetType ?? null, fciSymbols)) {
      return 'fci';
    }
    if (lots.some((lot) => lot.instrumentKind === 'caucion') || this.isCaucionHistoricalSymbol(symbol, lots[0]?.positionType ?? null, lots[0]?.assetType ?? null)) {
      return 'caucion';
    }
    return 'standard';
  }

  private resolveHistoricalMarketValueRule(lot: HistoricalLot): 'standard' | 'fci-direct-value' | 'caucion-quantity' {
    if (lot.instrumentKind === 'fci') {
      return 'fci-direct-value';
    }
    if (lot.instrumentKind === 'caucion') {
      return 'caucion-quantity';
    }
    return 'standard';
  }

  private detectHistoricalInstrumentKind(
    symbol: string,
    positionType: string | null,
    assetType: string | null,
    fciSymbols: Set<string>
  ): 'standard' | 'fci' | 'caucion' {
    if (this.isFciHistoricalSymbol(symbol, positionType, assetType, fciSymbols)) {
      return 'fci';
    }
    if (this.isCaucionHistoricalSymbol(symbol, positionType, assetType)) {
      return 'caucion';
    }
    return 'standard';
  }

  private isFciHistoricalSymbol(
    symbol: string,
    positionType: string | null,
    assetType: string | null,
    fciSymbols: Set<string>
  ): boolean {
    const normalized = symbol.trim().toUpperCase();
    const combined = `${positionType ?? ''} ${assetType ?? ''}`.toUpperCase();
    return (
      fciSymbols.has(normalized) ||
      combined.includes('FCI') ||
      combined.includes('VALORIZADO') ||
      combined.includes('MONEY MARKET')
    );
  }

  private isCaucionHistoricalSymbol(symbol: string, positionType: string | null, assetType: string | null): boolean {
    const normalized = symbol.trim().toUpperCase();
    const combined = `${positionType ?? ''} ${assetType ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return normalized.startsWith('CAUCION') || combined.includes('CAUCION');
  }

  private buildAmortizationAdjustedBenchmark(
    investedAmount: number,
    startIndex: number,
    endIndex: number,
    benchmarkRows: CalendarBenchmarkRow[],
    amortizationMovements: Array<{ date: Date; amount: number }>,
    warnings: string[]
  ): {
    usesAdjustedBenchmark: boolean;
    minimumExpectedValueAdjusted: number | null;
  } {
    if (!amortizationMovements.length) {
      return {
        usesAdjustedBenchmark: false,
        minimumExpectedValueAdjusted: null
      };
    }

    let exposedCapital = investedAmount;
    let lastIndex = startIndex;
    let benchmarkAccruedAmount = 0;
    let capitalReturnedAmount = 0;
    let usesAdjustedBenchmark = false;

    for (const movement of [...amortizationMovements].sort((left, right) => left.date.getTime() - right.date.getTime())) {
      const movementIndexInfo = this.benchmarkIndexInfo(benchmarkRows, movement.date);
      const movementIndex = movementIndexInfo.index;
      if (movementIndex === null || movementIndex <= 0) {
        warnings.push(`No se pudo ubicar una amortización en el calendario de benchmark para ${this.formatDate(movement.date)}.`);
        continue;
      }

      const benchmarkBeforeAmortization = exposedCapital * (movementIndex / lastIndex);
      benchmarkAccruedAmount += benchmarkBeforeAmortization - exposedCapital;

      capitalReturnedAmount += movement.amount;
      exposedCapital = Math.max(0, exposedCapital - movement.amount);
      lastIndex = movementIndex;
      usesAdjustedBenchmark = true;

      if (exposedCapital <= 0) {
        warnings.push('La amortización supera el capital expuesto del lote. Revisar datos.');
        exposedCapital = 0;
        break;
      }
    }

    const finalMinimumExpectedValue = exposedCapital > 0 ? exposedCapital * (endIndex / lastIndex) : 0;
    return {
      usesAdjustedBenchmark,
      minimumExpectedValueAdjusted: capitalReturnedAmount + benchmarkAccruedAmount + finalMinimumExpectedValue
    };
  }

  private buildHistoricalLots(
    operations: InvestmentOperation[],
    sales: InvestmentSale[],
    metadataBySymbol: Map<string, { positionType: string | null; assetType: string | null }>,
    fciSymbols: Set<string>
  ): HistoricalLot[] {
    const lots: HistoricalLot[] = [];

    for (const operation of operations) {
      const symbol = String(operation.symbol ?? '').trim().toUpperCase();
      const metadata = metadataBySymbol.get(symbol) ?? { positionType: null, assetType: null };
      lots.push({
        id: `op-${operation.id}`,
        symbol,
        currency: this.normalizeCurrency(operation.currency),
        positionType: metadata.positionType,
        assetType: metadata.assetType,
        buyDate: this.asDate(operation.date),
        sellDate: null,
        quantity: this.asNumber(operation.quantity),
        investedAmount: this.asNumber(operation.total ?? operation.amount),
        sourceTable: 'Tabla6',
        instrumentKind: this.detectHistoricalInstrumentKind(symbol, metadata.positionType, metadata.assetType, fciSymbols),
        fciSource: this.isFciHistoricalSymbol(symbol, metadata.positionType, metadata.assetType, fciSymbols)
          ? (fciSymbols.has(symbol) ? 'Tabla11' : 'heuristic')
          : null
      });
    }

    for (const sale of sales) {
      const symbol = String(sale.symbol ?? '').trim().toUpperCase();
      const metadata = metadataBySymbol.get(symbol) ?? { positionType: null, assetType: null };
      lots.push({
        id: `sale-${sale.id}`,
        symbol,
        currency: this.normalizeCurrency(sale.currency),
        positionType: metadata.positionType,
        assetType: metadata.assetType,
        buyDate: this.asDate(sale.buyDate),
        sellDate: this.asDate(sale.sellDate),
        quantity: this.asNumber(sale.quantity),
        investedAmount: this.asNumber(sale.total ?? sale.amount),
        sourceTable: 'Tabla13',
        instrumentKind: this.detectHistoricalInstrumentKind(symbol, metadata.positionType, metadata.assetType, fciSymbols),
        fciSource: this.isFciHistoricalSymbol(symbol, metadata.positionType, metadata.assetType, fciSymbols)
          ? (fciSymbols.has(symbol) ? 'Tabla11' : 'heuristic')
          : null
      });
    }

    return lots.filter(
      (lot) =>
        lot.symbol &&
        lot.buyDate !== null &&
        lot.quantity !== null &&
        lot.quantity > 0 &&
        lot.investedAmount !== null &&
        lot.investedAmount > 0
    );
  }

  private buildLotMetadataBySymbol(
    positions: PortfolioPosition[],
    classifications: AssetClassification[]
  ): Map<string, { positionType: string | null; assetType: string | null }> {
    const metadata = new Map<string, { positionType: string | null; assetType: string | null }>();
    const classificationBySymbol = new Map(
      classifications.map((item) => [String(item.symbol ?? '').trim().toUpperCase(), item])
    );

    for (const position of positions) {
      const symbol = String(position.symbol ?? '').trim().toUpperCase();
      if (!symbol) {
        continue;
      }
      const classification = classificationBySymbol.get(symbol) ?? null;
      metadata.set(symbol, {
        positionType: String(position.positionType ?? classification?.type ?? '').trim() || null,
        assetType: String(position.assetType ?? classification?.type ?? '').trim() || null
      });
    }

    for (const classification of classifications) {
      const symbol = String(classification.symbol ?? '').trim().toUpperCase();
      if (!symbol || metadata.has(symbol)) {
        continue;
      }
      metadata.set(symbol, {
        positionType: String(classification.type ?? '').trim() || null,
        assetType: String(classification.type ?? '').trim() || null
      });
    }

    return metadata;
  }

  private buildMonthlyEvaluationDates(monthlySummary: MonthlyInvestmentSummary[]): Date[] {
    const byKey = new Map<string, Date>();
    for (const row of monthlySummary) {
      const date = this.monthEndDate(row.month, row.year);
      if (!date) {
        continue;
      }
      byKey.set(date.toISOString().slice(0, 10), date);
    }
    return Array.from(byKey.values()).sort((left, right) => left.getTime() - right.getTime());
  }

  private buildDailyEvaluationDates(dataset: {
    historicalPrices?: HistoricalPrice[] | null;
    dailyBalances?: Array<{ date: string | Date | null }>;
  }): Date[] {
    const priceDates = (dataset.historicalPrices ?? [])
      .map((item) => this.asDate(item.date))
      .filter((date): date is Date => Boolean(date));
    const balanceDates = (dataset.dailyBalances ?? [])
      .map((item) => this.asDate(item.date))
      .filter((date): date is Date => Boolean(date));
    const sourceDates = priceDates.length ? priceDates : balanceDates;
    if (!sourceDates.length) {
      return [];
    }

    const latest = [...sourceDates].sort((left, right) => left.getTime() - right.getTime()).at(-1) ?? null;
    if (!latest) {
      return [];
    }
    const monthStart = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0));
    const byKey = new Map<string, Date>();

    for (const date of sourceDates) {
      if (date.getTime() < monthStart.getTime() || date.getTime() > monthEnd.getTime()) {
        continue;
      }
      byKey.set(date.toISOString().slice(0, 10), date);
    }

    return Array.from(byKey.values()).sort((left, right) => left.getTime() - right.getTime());
  }

  private buildSymbolDailyEvaluationDates(snapshot: PortfolioAppState, symbol: string): Date[] {
    const prices = (snapshot.dataset?.historicalPrices ?? [])
      .filter((item) => String(item.symbol ?? '').trim().toUpperCase() === symbol)
      .map((item) => ({ ...item, date: this.asDate(item.date) }))
      .filter((item): item is HistoricalPrice & { date: Date } => Boolean(item.date && item.price !== null));

    if (!prices.length) {
      return [];
    }

    const latest = [...prices].sort((left, right) => left.date.getTime() - right.date.getTime()).at(-1) ?? null;
    if (!latest) {
      return [];
    }

    const monthStart = new Date(Date.UTC(latest.date.getUTCFullYear(), latest.date.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(latest.date.getUTCFullYear(), latest.date.getUTCMonth() + 1, 0));
    const byKey = new Map<string, Date>();

    for (const price of prices) {
      if (price.date.getTime() < monthStart.getTime() || price.date.getTime() > monthEnd.getTime()) {
        continue;
      }
      byKey.set(price.date.toISOString().slice(0, 10), price.date);
    }

    return Array.from(byKey.values()).sort((left, right) => left.getTime() - right.getTime());
  }

  private monthEndDate(monthLabel: string | null | undefined, year: number | null | undefined): Date | null {
    if (!monthLabel) {
      return null;
    }

    const parsedDate = parseExcelDate(monthLabel);
    if (parsedDate) {
      return new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth() + 1, 0));
    }

    const normalized = String(monthLabel)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const monthMap: Record<string, number> = {
      ene: 0,
      enero: 0,
      feb: 1,
      febrero: 1,
      mar: 2,
      marzo: 2,
      abr: 3,
      abril: 3,
      may: 4,
      mayo: 4,
      jun: 5,
      junio: 5,
      jul: 6,
      julio: 6,
      ago: 7,
      agosto: 7,
      sep: 8,
      sept: 8,
      septiembre: 8,
      oct: 9,
      octubre: 9,
      nov: 10,
      noviembre: 10,
      dic: 11,
      diciembre: 11
    };

    const parts = normalized.split(/[\s\/\-_.]+/).filter(Boolean);
    let monthIndex: number | null = null;
    let parsedYear = year ?? null;

    for (const part of parts) {
      if (monthIndex === null && monthMap[part] !== undefined) {
        monthIndex = monthMap[part];
        continue;
      }
      if (parsedYear === null && /^\d{2,4}$/.test(part)) {
        const numeric = Number(part);
        parsedYear = numeric < 100 ? (numeric < 70 ? 2000 + numeric : 1900 + numeric) : numeric;
      }
    }

    if (monthIndex === null || parsedYear === null) {
      return null;
    }

    const date = new Date(Date.UTC(parsedYear, monthIndex + 1, 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private indexHistoricalPrices(prices: HistoricalPrice[]): Map<string, HistoricalPrice[]> {
    const bucket = new Map<string, HistoricalPrice[]>();
    for (const price of prices) {
      const symbol = String(price.symbol ?? '').trim().toUpperCase();
      const date = this.asDate(price.date);
      const numericPrice = this.asNumber(price.price);
      if (!symbol || !date || numericPrice === null) {
        continue;
      }
      const list = bucket.get(symbol) ?? [];
      list.push({ ...price, date, price: numericPrice });
      bucket.set(symbol, list);
    }

    for (const list of bucket.values()) {
      list.sort((left, right) => this.dateValue(left.date) - this.dateValue(right.date));
    }

    return bucket;
  }

  private resolveBenchmarkRows(rows: CalendarBenchmarkRow[]): {
    rows: CalendarBenchmarkRow[];
    source: CalendarBenchmarkRow['source'] | null;
    availableSources: CalendarBenchmarkRow['source'][];
    notes: string[];
  } {
    const availableSources = Array.from(
      new Set(rows.map((row) => row.source).filter((source): source is CalendarBenchmarkRow['source'] => Boolean(source)))
    );
    const priority: CalendarBenchmarkRow['source'][] = ['TablaCalendario', 'TablaCalendarioRem', 'TablaCalendarioInf'];

    for (const source of priority) {
      const selected = rows
        .filter((row) => row.source === source && row.index !== null)
        .sort((left, right) => left.date.getTime() - right.date.getTime());

      if (selected.length) {
        return {
          rows: selected,
          source,
          availableSources,
          notes: source === 'TablaCalendario' ? [] : [`Se utilizo ${source} como respaldo de calendario.`]
        };
      }
    }

    return {
      rows: [],
      source: null,
      availableSources,
      notes: ['No se encontraron filas de calendario para calcular el minimo esperado.']
    };
  }

  private indexBenchmarkRows(rows: CalendarBenchmarkRow[]): CalendarBenchmarkRow[] {
    return [...rows]
      .filter((row) => row.index !== null && row.date instanceof Date && !Number.isNaN(row.date.getTime()))
      .sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  private indexMovements(movements: InvestmentMovement[]): Map<string, InvestmentMovement[]> {
    const bucket = new Map<string, InvestmentMovement[]>();
    for (const movement of movements) {
      const symbol = String(movement.symbol ?? '').trim().toUpperCase();
      const date = this.asDate(movement.date);
      const amount = this.asNumber(movement.amount);
      if (!symbol || !date || amount === null || !Number.isFinite(amount)) {
        continue;
      }
      const normalized: InvestmentMovement = {
        ...movement,
        date,
        symbol,
        amount
      };
      const list = bucket.get(symbol) ?? [];
      list.push(normalized);
      bucket.set(symbol, list);
    }

    for (const list of bucket.values()) {
      list.sort((left, right) => this.dateValue(left.date) - this.dateValue(right.date));
    }

    return bucket;
  }

  private priceAtOrBefore(priceIndex: Map<string, HistoricalPrice[]>, symbol: string, date: Date): number | null {
    return this.priceAtOrBeforeInfo(priceIndex, symbol, date).price;
  }

  private priceAtOrBeforeInfo(
    priceIndex: Map<string, HistoricalPrice[]>,
    symbol: string,
    date: Date
  ): { price: number | null; date: Date | null } {
    const prices = priceIndex.get(symbol) ?? [];
    if (!prices.length) {
      return { price: null, date: null };
    }

    let candidate: HistoricalPrice | null = null;
    for (const price of prices) {
      if (!price.date) {
        continue;
      }
      if (this.dateValue(price.date) <= date.getTime()) {
        candidate = price;
        continue;
      }
      break;
    }

    return {
      price: candidate?.price ?? null,
      date: candidate?.date ? new Date(candidate.date) : null
    };
  }

  private isLotActiveAtDate(lot: HistoricalLot, date: Date): boolean {
    const buyDate = lot.buyDate?.getTime() ?? 0;
    const sellDate = lot.sellDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const target = date.getTime();
    return buyDate <= target && target < sellDate;
  }

  private isCurrencyCompatible(lotCurrency: CanonicalCurrency | 'UNKNOWN', movementCurrency: CanonicalCurrency | 'UNKNOWN'): boolean {
    return (
      movementCurrency === 'UNKNOWN' ||
      lotCurrency === 'UNKNOWN' ||
      lotCurrency === movementCurrency
    );
  }

  private resolveTrendStatus(points: MinimumBalanceTrendPoint[]): MinimumBalanceTrendStatus {
    if (points.length < 2) {
      return 'not-available';
    }
    const current = points.at(-1) ?? null;
    const previous = this.closestPoint(points, 30);
    if (!current || !previous || current.balanceVsMinimumPercent === null || previous.balanceVsMinimumPercent === null) {
      return 'not-available';
    }
    const delta = current.balanceVsMinimumPercent - previous.balanceVsMinimumPercent;
    if (delta > 1) {
      return 'improving';
    }
    if (delta < -1) {
      return 'deteriorating';
    }
    return 'stable';
  }

  private trendLabel(status: MinimumBalanceTrendStatus): string {
    switch (status) {
      case 'improving':
        return 'Mejorando';
      case 'deteriorating':
        return 'Deteriorándose';
      case 'stable':
        return 'Estable';
      case 'not-available':
      default:
        return 'Sin historial suficiente';
    }
  }

  private bestPoint(points: MinimumBalanceTrendPoint[]): MinimumBalanceTrendPoint | null {
    return points.reduce<MinimumBalanceTrendPoint | null>((best, current) => {
      if (!best || current.balanceVsMinimumARS > best.balanceVsMinimumARS) {
        return current;
      }
      return best;
    }, null);
  }

  private worstPoint(points: MinimumBalanceTrendPoint[]): MinimumBalanceTrendPoint | null {
    return points.reduce<MinimumBalanceTrendPoint | null>((worst, current) => {
      if (!worst || current.balanceVsMinimumARS < worst.balanceVsMinimumARS) {
        return current;
      }
      return worst;
    }, null);
  }

  private deltaAtDays(points: MinimumBalanceTrendPoint[], days: number): number | null {
    const current = points.at(-1) ?? null;
    const previous = this.closestPoint(points, days);
    if (!current || !previous) {
      return null;
    }
    return current.balanceVsMinimumARS - previous.balanceVsMinimumARS;
  }

  private deltaPercentAtDays(points: MinimumBalanceTrendPoint[], days: number): number | null {
    const current = points.at(-1) ?? null;
    const previous = this.closestPoint(points, days);
    if (!current || !previous || current.balanceVsMinimumPercent === null || previous.balanceVsMinimumPercent === null) {
      return null;
    }
    return current.balanceVsMinimumPercent - previous.balanceVsMinimumPercent;
  }

  private closestPoint(points: MinimumBalanceTrendPoint[], days: number): MinimumBalanceTrendPoint | null {
    if (points.length < 2) {
      return null;
    }
    const current = points.at(-1);
    if (!current) {
      return null;
    }
    const currentDate = this.asDate(current.date);
    if (!currentDate) {
      return points.at(-2) ?? null;
    }

    const target = currentDate.getTime() - days * 24 * 60 * 60 * 1000;
    let candidate: MinimumBalanceTrendPoint | null = null;
    for (const point of points) {
      const pointDate = this.asDate(point.date);
      if (!pointDate) {
        continue;
      }
      if (pointDate.getTime() <= target) {
        candidate = point;
      }
    }
    return candidate ?? points[0] ?? null;
  }

  private sumNumbers(values: Array<number | null | undefined>): number {
    return values.reduce<number>((sum, value) => {
      return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
    }, 0);
  }

  private pickLatestNumber(values: Array<number | null | undefined>): number | null {
    const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    return filtered.length ? filtered[filtered.length - 1] : null;
  }

  private pickLatestDate(values: Array<string | null | undefined>): string | null {
    const filtered = values.filter((value): value is string => Boolean(value));
    return filtered.length ? filtered[filtered.length - 1] : null;
  }

  private joinUniqueStrings(values: Array<string | null | undefined>, fallback: string): string {
    const unique = Array.from(
      new Set(values.map((value) => String(value ?? '').trim()).filter((value) => Boolean(value)))
    );
    if (!unique.length) {
      return fallback;
    }
    if (unique.length === 1) {
      return unique[0];
    }
    return unique.join(' + ');
  }

  private uniqueWarnings(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
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

    const cleaned = text
      .replace(/\$/g, '')
      .replace(/\s+/g, '')
      .replace(/[^0-9.,-]/g, '');

    if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') {
      return null;
    }

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      const normalized = lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (hasComma && !hasDot) {
      const normalized = cleaned.replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeCurrency(value: unknown): CanonicalCurrency | 'UNKNOWN' {
    const text = String(value ?? '').trim().toUpperCase();
    if (!text) {
      return 'UNKNOWN';
    }
    if (['AR', 'ARS', '$', 'PESO', 'PESOS', 'ARG', 'ARGENTINA'].includes(text)) {
      return 'ARS';
    }
    if (['US', 'USD', 'US$', 'U$S', 'DOLAR', 'DOLARES', 'DOLAR USA', 'DOLARES USA'].includes(text)) {
      return 'USD';
    }
    return 'UNKNOWN';
  }

  private extractFciSymbols(tables: WorkbookTableData[]): Set<string> {
    const symbols = new Set<string>();
    const table = tables.find((item) => this.isWorkbookTableNamed(item, ['Tabla11', 'tabla11']));
    if (!table) {
      return symbols;
    }

    for (const row of table.rows ?? []) {
      const value = this.getRowCellValue(row, ['Fondos com. Inv.', 'Fondos com Inv', 'Fondos com. Inv']);
      const symbol = String(value ?? '').trim().toUpperCase();
      if (symbol) {
        symbols.add(symbol);
      }
    }

    return symbols;
  }

  private isWorkbookTableNamed(table: WorkbookTableData, names: string[]): boolean {
    const normalized = [table.name, table.displayName].map((value) => this.normalizeKey(value));
    return names.some((name) => normalized.includes(this.normalizeKey(name)));
  }

  private getRowCellValue(row: Record<string, unknown>, headers: string[]): unknown {
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

  private dateValue(value: Date | string | null | undefined): number {
    const date = this.asDate(value);
    return date ? date.getTime() : 0;
  }

  private debugDateKey(value: Date | string | null | undefined): string | null {
    const date = this.asDate(value);
    return date ? date.toISOString().slice(0, 10) : null;
  }

  private debugBenchmarkSourceLabel(
    buyRow: CalendarBenchmarkRow | null,
    evalRow: CalendarBenchmarkRow | null
  ): string | null {
    const buySource = buyRow?.source ?? null;
    const evalSource = evalRow?.source ?? null;
    if (!buySource && !evalSource) {
      return null;
    }
    if (buySource === evalSource) {
      return buySource;
    }
    return [buySource ?? 'N/D', evalSource ?? 'N/D'].join(' -> ');
  }

  private debugImpactScore(values: {
    balanceVsMinimum: number | null;
    minimumExpectedUsed: number | null;
    comparableValue: number | null;
    marketValue: number | null;
    capitalReturnedAmount: number;
    incomeAmount: number;
  }): number {
    const candidates = [
      values.balanceVsMinimum,
      values.minimumExpectedUsed,
      values.comparableValue,
      values.marketValue,
      values.capitalReturnedAmount,
      values.incomeAmount
    ];
    return Math.max(...candidates.map((value) => Math.abs(value ?? 0)));
  }

  private isValuationLikeLot(lot: HistoricalLot, fciSymbols: Set<string>): boolean {
    const combined = `${lot.assetType ?? ''} ${lot.positionType ?? ''}`.toUpperCase();
    return (
      fciSymbols.has(lot.symbol.toUpperCase()) ||
      combined.includes('FCI') ||
      combined.includes('VALORIZADO') ||
      combined.includes('MONEY MARKET') ||
      ['IOLCAMA', 'IOLCADO', 'IOLDOLD', 'PRPEDOB'].includes(lot.symbol.toUpperCase())
    );
  }

  private shouldSkipHistoricalLot(
    lot: HistoricalLot,
    marketValue: number | null,
    investedAmount: number | null,
    fciSymbols: Set<string>
  ): { skip: boolean; reason: string | null; warning: string | null } {
    if (lot.currency !== 'ARS') {
      return { skip: true, reason: 'unsupported-currency', warning: null };
    }
    if (this.isValuationLikeLot(lot, fciSymbols)) {
      return {
        skip: true,
        reason: 'valuation-like-instrument',
        warning: `FCI/valor valorizado omitido en histórico: no hay fórmula confiable para reconstruir valor por cantidad * precio para ${lot.symbol}.`
      };
    }
    if (this.isNonComparableHistoricalInstrument(lot.symbol)) {
      return {
        skip: true,
        reason: 'non-comparable-instrument',
        warning: `Instrumento no comparable omitido en histórico: ${lot.symbol}. No se reconstruye por cantidad * precio.`
      };
    }
    if (marketValue !== null && investedAmount !== null && investedAmount > 0 && marketValue > investedAmount * 100) {
      return {
        skip: true,
        reason: 'suspicious-scale',
        warning: `Valor histórico sospechoso para ${lot.symbol}: marketValue muy superior al capital invertido. Revisar escala de precio/cantidad.`
      };
    }
    return { skip: false, reason: null, warning: null };
  }

  private isNonComparableHistoricalInstrument(symbol: string): boolean {
    const normalized = symbol.trim().toUpperCase();
    return ['CAUCION', 'CAUCIÓN COLOCADORA', 'ADRDOLA', 'PRFAHOB'].includes(normalized);
  }

  private formatDate(value: Date): string {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const year = value.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}

