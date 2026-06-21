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
import { parseExcelDate } from '../utils/value-parsing.utils';

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

interface HistoricalPointBuildResult {
  points: MinimumBalanceTrendPoint[];
  warnings: string[];
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

@Injectable({ providedIn: 'root' })
export class PortfolioMinimumBalanceTrendService {
  constructor(private readonly minimumPerformance: MinimumPerformanceService) {}

  buildTrend(snapshot: PortfolioAppState): MinimumBalanceTrendSummary {
    const minimumSummary = this.minimumPerformance.buildMinimumPerformanceSummary(snapshot);
    const bySymbol = this.minimumPerformance.buildMinimumPerformanceBySymbol(snapshot);
    const historical = this.buildHistoricalPoints(snapshot);
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

  private buildHistoricalPoints(snapshot: PortfolioAppState): HistoricalPointBuildResult {
    const warnings: string[] = [];
    const dataset = snapshot.dataset;

    if (!dataset) {
      return {
        points: [],
        warnings: [
          'No hay serie histórica confiable de Balance vs mínimo ARS.',
          'No hay dataset disponible para construir la serie histórica de Balance vs mínimo ARS.'
        ]
      };
    }

    const evaluationDates = this.buildMonthlyEvaluationDates(dataset.monthlySummary ?? []);
    if (!evaluationDates.length) {
      return {
        points: [],
        warnings: [
          'No hay serie histórica confiable de Balance vs mínimo ARS.',
          'No hay historial mensual suficiente para construir la serie histórica de Balance vs mínimo ARS.'
        ]
      };
    }

    const lots = this.buildHistoricalLots(
      dataset.operations ?? [],
      dataset.sales ?? [],
      this.buildLotMetadataBySymbol(dataset.positions ?? [], dataset.classifications ?? [])
    );
    const arsLots = lots.filter((lot) => lot.currency === 'ARS' && lot.buyDate !== null);
    if (!arsLots.length) {
      return {
        points: [],
        warnings: [
          'No hay serie histórica confiable de Balance vs mínimo ARS.',
          'No hay lotes ARS suficientes para construir la serie histórica de Balance vs mínimo ARS.'
        ]
      };
    }

    const priceIndex = this.indexHistoricalPrices(dataset.historicalPrices ?? []);
    const benchmarkRows = this.indexBenchmarkRows(dataset.calendarBenchmarks ?? []);
    if (!benchmarkRows.length) {
      return {
        points: [],
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
        priceIndex,
        benchmarkRows,
        movementsIndex,
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
    }

    return {
      points,
      warnings: this.uniqueWarnings(warnings)
    };
  }

  private buildDebugReportForDate(snapshot: PortfolioAppState, date: Date): MinimumBalanceTrendDateDebugReport {
    const warnings: string[] = [];
    const dataset = snapshot.dataset;

    if (!dataset) {
      return {
        date: this.debugDateKey(date) ?? date.toISOString().slice(0, 10),
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
      this.buildLotMetadataBySymbol(dataset.positions ?? [], dataset.classifications ?? [])
    );
    const benchmarkRows = this.indexBenchmarkRows(dataset.calendarBenchmarks ?? []);
    const priceIndex = this.indexHistoricalPrices(dataset.historicalPrices ?? []);
    const movementsIndex = this.indexMovements(dataset.investmentMovements ?? []);
    const activeLots = lots.filter((lot) => lot.currency === 'ARS' && this.isLotActiveAtDate(lot, date));
    const movementTotalsByLot = this.buildMovementTotalsByLot(activeLots, movementsIndex, date, warnings);

    const rows = lots.map((lot) =>
      this.buildDebugLotRowForDate({
        lot,
        date,
        priceIndex,
        benchmarkRows,
        movementTotalsByLot,
        warnings
      })
    );

    const includedRows = rows.filter((row) => !row.skipped && row.minimumExpectedUsed !== null && row.comparableValue !== null);
    const comparableValueARS = includedRows.reduce((sum, row) => sum + (row.comparableValue ?? 0), 0);
    const minimumExpectedARS = includedRows.reduce((sum, row) => sum + (row.minimumExpectedUsed ?? 0), 0);
    const balanceVsMinimumARS = comparableValueARS - minimumExpectedARS;
    const balanceVsMinimumPercent = minimumExpectedARS > 0 ? ((comparableValueARS / minimumExpectedARS) - 1) * 100 : null;

    return {
      date: this.debugDateKey(date) ?? date.toISOString().slice(0, 10),
      totals: {
        comparableValueARS,
        minimumExpectedARS,
        balanceVsMinimumARS,
        balanceVsMinimumPercent,
        includedLots: includedRows.length,
        skippedLots: rows.length - includedRows.length
      },
      lots: rows,
      warnings: this.uniqueWarnings([
        ...warnings,
        ...this.buildTrend(snapshot).warnings
      ])
    };
  }

  private buildDebugLotRowForDate(args: {
    lot: HistoricalLot;
    date: Date;
    priceIndex: Map<string, HistoricalPrice[]>;
    benchmarkRows: CalendarBenchmarkRow[];
    movementTotalsByLot: Map<string, HistoricalLotMovementTotals>;
    warnings: string[];
  }): MinimumBalanceTrendLotDebugRow {
    const { lot, date, priceIndex, benchmarkRows, movementTotalsByLot, warnings } = args;
    const emptyRow = {
      lotId: lot.id,
      sourceTable: lot.sourceTable,
      symbol: lot.symbol,
      currency: lot.currency,
      positionType: lot.positionType,
      assetType: lot.assetType,
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
      movements: [] as MinimumBalanceTrendLotMovementDebug[],
      skipped: true,
      skipReason: null
    } satisfies MinimumBalanceTrendLotDebugRow;

    if (lot.currency !== 'ARS') {
      return { ...emptyRow, skipReason: 'unsupported-currency' };
    }

    if (!this.isLotActiveAtDate(lot, date)) {
      return { ...emptyRow, skipReason: 'lot-not-active-at-date' };
    }

    const historicalPriceInfo = this.priceAtOrBeforeInfo(priceIndex, lot.symbol, date);
    if (historicalPriceInfo.price === null) {
      warnings.push(`No hay precio historico disponible para ${lot.symbol} antes de ${this.formatDate(date)}. Lote omitido en ese punto.`);
      return { ...emptyRow, skipReason: 'missing-historical-price' };
    }

    if (lot.investedAmount === null || lot.investedAmount <= 0 || !lot.buyDate) {
      return { ...emptyRow, skipReason: 'missing-invested-amount' };
    }

    const marketValue = (lot.quantity ?? 0) * historicalPriceInfo.price;
    const suspicious = this.shouldSkipHistoricalLot(lot, marketValue, lot.investedAmount);
    if (suspicious.skip) {
      if (suspicious.warning) {
        warnings.push(suspicious.warning);
      }
      return {
        ...emptyRow,
        historicalPrice: historicalPriceInfo.price,
        historicalPriceDate: this.debugDateKey(historicalPriceInfo.date),
        marketValue,
        skipReason: suspicious.reason
      };
    }

    const benchmarkStart = this.benchmarkIndexInfo(benchmarkRows, lot.buyDate);
    const benchmarkEnd = this.benchmarkIndexInfo(benchmarkRows, date);
    if (benchmarkStart.index === null || benchmarkEnd.index === null || benchmarkStart.index <= 0 || benchmarkEnd.index <= 0) {
      warnings.push(`No se pudo calcular el benchmark para ${lot.symbol} en ${this.formatDate(date)}.`);
      return { ...emptyRow, skipReason: 'missing-benchmark-index' };
    }

    const lotMovements = movementTotalsByLot.get(lot.id) ?? {
      incomeAmount: 0,
      capitalReturnedAmount: 0,
      amortizations: [],
      appliedMovements: []
    };

    const comparableValue = marketValue + lotMovements.incomeAmount + lotMovements.capitalReturnedAmount;
    const adjustedBenchmark = this.buildAmortizationAdjustedBenchmark(
      lot.investedAmount,
      benchmarkStart.index,
      benchmarkEnd.index,
      benchmarkRows,
      lotMovements.amortizations,
      warnings
    );
    const rawMinimumExpected = lot.investedAmount * (benchmarkEnd.index / benchmarkStart.index);
    const minimumExpectedUsed = adjustedBenchmark.usesAdjustedBenchmark
      ? adjustedBenchmark.minimumExpectedValueAdjusted
      : rawMinimumExpected;

    if (minimumExpectedUsed === null || !Number.isFinite(minimumExpectedUsed)) {
      warnings.push(`No se pudo calcular el minimo esperado para ${lot.symbol} en ${this.formatDate(date)}.`);
      return { ...emptyRow, skipReason: 'missing-minimum-expected' };
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

    return {
      ...emptyRow,
      historicalPrice: historicalPriceInfo.price,
      historicalPriceDate: this.debugDateKey(historicalPriceInfo.date),
      marketValue,
      benchmarkSource: this.debugBenchmarkSourceLabel(benchmarkStart.row, benchmarkEnd.row),
      buyBenchmarkSource: benchmarkStart.row?.source ?? null,
      evalBenchmarkSource: benchmarkEnd.row?.source ?? null,
      buyIndex: benchmarkStart.index,
      buyIndexDate: this.debugDateKey(benchmarkStart.row?.date ?? null),
      evalIndex: benchmarkEnd.index,
      evalIndexDate: this.debugDateKey(benchmarkEnd.row?.date ?? null),
      benchmarkRatio: benchmarkStart.index && benchmarkEnd.index ? benchmarkEnd.index / benchmarkStart.index : null,
      rawMinimumExpected,
      adjustedMinimumExpected: adjustedBenchmark.usesAdjustedBenchmark ? adjustedBenchmark.minimumExpectedValueAdjusted : null,
      minimumExpectedUsed,
      incomeAmount: lotMovements.incomeAmount,
      capitalReturnedAmount: lotMovements.capitalReturnedAmount,
      comparableValue,
      balanceVsMinimum,
      balanceVsMinimumPercent,
      impactScore,
      movements: lotMovements.appliedMovements.map((movement) => ({
        date: this.debugDateKey(movement.date) ?? '',
        type: movement.type,
        amount: movement.amount,
        affectsPerformance: movement.affectsPerformance,
        affectsInvestedCapital: movement.affectsInvestedCapital,
        capitalEffect: movement.capitalEffect,
        assignedAmount: movement.assignedAmount,
        note: movement.note
      })),
      skipped: false,
      skipReason: null
    };
  }

  private buildPointForDate(args: {
    date: Date;
    lots: HistoricalLot[];
    priceIndex: Map<string, HistoricalPrice[]>;
    benchmarkRows: CalendarBenchmarkRow[];
    movementsIndex: Map<string, InvestmentMovement[]>;
    warnings: string[];
  }): MinimumBalanceTrendPoint | null {
    const { date, lots, priceIndex, benchmarkRows, movementsIndex, warnings } = args;
    const activeLots = lots.filter((lot) => this.isLotActiveAtDate(lot, date));
    if (!activeLots.length) {
      return null;
    }

    const movementTotalsByLot = this.buildMovementTotalsByLot(activeLots, movementsIndex, date, warnings);
    let comparableTotal = 0;
    let minimumExpectedTotal = 0;
    let includedLots = 0;

    for (const lot of activeLots) {
      const historicalPrice = this.priceAtOrBefore(priceIndex, lot.symbol, date);
      const investedAmount = lot.investedAmount;
      const buyDate = lot.buyDate;
      if (historicalPrice === null) {
        warnings.push(`No hay precio histórico disponible para ${lot.symbol} antes de ${this.formatDate(date)}. Lote omitido en ese punto.`);
        continue;
      }
      if (investedAmount === null || investedAmount <= 0 || !buyDate) {
        continue;
      }

      if (this.isValuationLikeLot(lot)) {
        warnings.push(
          `FCI/valor valorizado omitido en histórico: no hay fórmula confiable para reconstruir valor por cantidad * precio para ${lot.symbol}.`
        );
        continue;
      }

      const benchmarkStart = this.benchmarkIndexInfo(benchmarkRows, buyDate);
      const benchmarkEnd = this.benchmarkIndexInfo(benchmarkRows, date);
      if (benchmarkStart.index === null || benchmarkEnd.index === null || benchmarkStart.index <= 0 || benchmarkEnd.index <= 0) {
        warnings.push(`No se pudo calcular el benchmark para ${lot.symbol} en ${this.formatDate(date)}.`);
        continue;
      }

      const lotMovements = movementTotalsByLot.get(lot.id) ?? {
        incomeAmount: 0,
        capitalReturnedAmount: 0,
        amortizations: [],
        appliedMovements: []
      };

      const marketValue = (lot.quantity ?? 0) * historicalPrice;
      if (investedAmount > 0 && marketValue > investedAmount * 100) {
        warnings.push(
          `Valor histórico sospechoso para ${lot.symbol}: marketValue muy superior al capital invertido. Revisar escala de precio/cantidad.`
        );
        continue;
      }
      const comparableValue = marketValue + lotMovements.incomeAmount + lotMovements.capitalReturnedAmount;
      const adjustedBenchmark = this.buildAmortizationAdjustedBenchmark(
        investedAmount,
        benchmarkStart.index,
        benchmarkEnd.index,
        benchmarkRows,
        lotMovements.amortizations,
        warnings
      );
      const minimumExpectedValue = adjustedBenchmark.usesAdjustedBenchmark
        ? adjustedBenchmark.minimumExpectedValueAdjusted
        : investedAmount * (benchmarkEnd.index / benchmarkStart.index);

      if (minimumExpectedValue === null || !Number.isFinite(minimumExpectedValue)) {
        warnings.push(`No se pudo calcular el mínimo esperado para ${lot.symbol} en ${this.formatDate(date)}.`);
        continue;
      }

      comparableTotal += comparableValue;
      minimumExpectedTotal += minimumExpectedValue;
      includedLots += 1;
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
    metadataBySymbol: Map<string, { positionType: string | null; assetType: string | null }>
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
        sourceTable: 'Tabla6'
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
        sourceTable: 'Tabla13'
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
    return buyDate <= target && target <= sellDate;
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

  private isValuationLikeLot(lot: HistoricalLot): boolean {
    const combined = `${lot.assetType ?? ''} ${lot.positionType ?? ''}`.toUpperCase();
    return (
      combined.includes('FCI') ||
      combined.includes('VALORIZADO') ||
      combined.includes('MONEY MARKET') ||
      ['IOLCAMA', 'IOLCADO', 'IOLDOLD', 'PRPEDOB'].includes(lot.symbol.toUpperCase())
    );
  }

  private shouldSkipHistoricalLot(
    lot: HistoricalLot,
    marketValue: number | null,
    investedAmount: number | null
  ): { skip: boolean; reason: string | null; warning: string | null } {
    if (lot.currency !== 'ARS') {
      return { skip: true, reason: 'unsupported-currency', warning: null };
    }
    if (this.isValuationLikeLot(lot)) {
      return {
        skip: true,
        reason: 'valuation-like-instrument',
        warning: `FCI/valor valorizado omitido en histórico: no hay fórmula confiable para reconstruir valor por cantidad * precio para ${lot.symbol}.`
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

  private formatDate(value: Date): string {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const year = value.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}
