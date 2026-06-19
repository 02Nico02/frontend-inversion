import { Injectable } from '@angular/core';
import { MinimumPerformanceBySymbol } from '../models/minimum-performance.model';
import { InvestmentMovementSummary } from '../models/investment-movements.model';
import { PortfolioPosition } from '../models/portfolio.models';
import { PortfolioCalculatorService } from './portfolio-calculator.service';
import { MinimumPerformanceService } from './minimum-performance.service';
import { InvestmentMovementsPerformanceService } from './investment-movements-performance.service';
import { PortfolioAppState } from './portfolio-state.service';
import { CurrencyMapperService } from './currency-mapper.service';

export interface EffectivePortfolioPosition {
  symbol: string;
  currency: string;
  position: PortfolioPosition;
  nominalResultAmount: number | null;
  nominalResultPercent: number | null;
  effectiveResultAmount: number | null;
  effectiveResultPercent: number | null;
  resultWasAdjustedByMovements: boolean;
  movementSummary: InvestmentMovementSummary | null;
  minimumPerformance: MinimumPerformanceBySymbol | null;
  minimumExpectedValue: number | null;
  minimumValueVsAmount: number | null;
  minimumValueVsPercent: number | null;
  minimumWasAdjustedByMovements: boolean;
  notes: string[];
}

@Injectable({ providedIn: 'root' })
export class PositionEffectiveMetricsService {
  constructor(
    private readonly calculator: PortfolioCalculatorService,
    private readonly movementsPerformance: InvestmentMovementsPerformanceService,
    private readonly minimumPerformanceService: MinimumPerformanceService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  buildEffectivePositions(snapshot: PortfolioAppState): EffectivePortfolioPosition[] {
    const positions = snapshot.dataset
      ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications)
      : [];
    const movementSummaries = snapshot.dataset ? this.movementsPerformance.buildSummaryBySymbol(snapshot) : [];
    const minimumSummaries = snapshot.dataset ? this.minimumPerformanceService.buildMinimumPerformanceBySymbol(snapshot) : [];

    const movementSummaryMap = new Map(
      movementSummaries.map((summary) => [this.key(summary.symbol, summary.currency), summary] as const)
    );
    const minimumSummaryMap = new Map(
      minimumSummaries.map((summary) => [this.key(summary.symbol, summary.currency), summary] as const)
    );

    return positions.map((position) => {
      const key = this.key(position.symbol, position.currency);
      const movementSummary = movementSummaryMap.get(key) ?? null;
      const minimumPerformance = minimumSummaryMap.get(key) ?? null;
      const nominalResultAmount = position.resultAmount ?? null;
      const nominalResultPercent = position.resultPercent ?? null;
      const resultWasAdjustedByMovements = Boolean(movementSummary?.hasAdjustments);
      const effectiveResultAmount = resultWasAdjustedByMovements && movementSummary?.adjustedResultAmount !== null
        ? movementSummary?.adjustedResultAmount ?? nominalResultAmount
        : nominalResultAmount;
      const effectiveResultPercent = resultWasAdjustedByMovements && movementSummary?.adjustedResultPercent !== null
        ? movementSummary?.adjustedResultPercent ?? nominalResultPercent
        : nominalResultPercent;
      const minimumExpectedValue = minimumPerformance?.minimumExpectedValue ?? null;
      const minimumValueVsAmount = minimumPerformance?.valueVsMinimumAmount ?? null;
      const minimumValueVsPercent = minimumPerformance?.valueVsMinimumPercent ?? null;
      const minimumWasAdjustedByMovements = Boolean(
        minimumPerformance?.usesAdjustedComparableValue || minimumPerformance?.usesAmortizationAdjustedBenchmark
      );
      const notes = [
        ...(resultWasAdjustedByMovements ? ['Resultado ajustado por movimientos de inversión.'] : []),
        ...(minimumWasAdjustedByMovements ? ['Benchmark mínimo ajustado por movimientos/amortizaciones.'] : []),
        ...(minimumPerformance?.notes ?? [])
      ];

      return {
        symbol: position.symbol,
        currency: this.currencyMapper.normalizeCurrency(position.currency),
        position,
        nominalResultAmount,
        nominalResultPercent,
        effectiveResultAmount,
        effectiveResultPercent,
        resultWasAdjustedByMovements,
        movementSummary,
        minimumPerformance,
        minimumExpectedValue,
        minimumValueVsAmount,
        minimumValueVsPercent,
        minimumWasAdjustedByMovements,
        notes: Array.from(new Set(notes.filter(Boolean)))
      };
    });
  }

  buildEffectivePositionMap(snapshot: PortfolioAppState): Map<string, EffectivePortfolioPosition> {
    return new Map(this.buildEffectivePositions(snapshot).map((item) => [this.key(item.symbol, item.currency), item] as const));
  }

  private key(symbol: string, currency: string): string {
    return `${String(symbol ?? '').toUpperCase()}__${this.currencyMapper.normalizeCurrency(currency)}`;
  }
}
