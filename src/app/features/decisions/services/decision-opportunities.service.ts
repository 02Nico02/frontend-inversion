import { Injectable } from '@angular/core';
import { MinimumPerformanceBySymbol, MinimumPerformanceSummary } from '../../../core/models/minimum-performance.model';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { MinimumPerformanceService } from '../../../core/services/minimum-performance.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { EffectivePortfolioPosition, PositionEffectiveMetricsService } from '../../../core/services/position-effective-metrics.service';

export interface MinimumBenchmarkReviewItem {
  symbol: string;
  currency: string;
  valueVsMinimumAmount: number;
  valueVsMinimumPercent: number;
  reason: string;
}

export interface ActivatedAlertItem {
  symbol: string;
  group: string;
  condition: string | null;
  currentPrice: number | null;
  targetPrice: number | null;
  note: string | null;
  status: string;
  priority: string;
  distancePercent: number | null;
}

export interface DecisionMinimumBenchmarkReview {
  totalBelowMinimum: number;
  totalDeficitAmount: number;
  items: MinimumBenchmarkReviewItem[];
  summary: MinimumPerformanceSummary | null;
}

export interface DecisionActivatedAlerts {
  total: number;
  items: ActivatedAlertItem[];
}

export interface MisleadingPositionItem {
  symbol: string;
  currency: string;
  currentValue: number;
  investedAmount: number;
  nominalResultAmount: number;
  nominalResultPercent: number;
  minimumExpectedValue: number;
  comparableValue: number;
  valueVsMinimumAmount: number;
  valueVsMinimumPercent: number;
  note: string;
}

export interface DecisionMisleadingPositionsReview {
  total: number;
  items: MisleadingPositionItem[];
  note: string;
}

export interface DecisionOpportunitiesViewModel {
  minimumBenchmarkReview: DecisionMinimumBenchmarkReview;
  activatedAlerts: DecisionActivatedAlerts;
  misleadingPositions: DecisionMisleadingPositionsReview;
}

const MINIMUM_BENCHMARK_REVIEW_PERCENT_THRESHOLD = -5;
const MINIMUM_BENCHMARK_REVIEW_AMOUNT_THRESHOLD = -10000;

@Injectable({ providedIn: 'root' })
export class DecisionOpportunitiesService {
  constructor(
    private readonly minimumPerformanceService: MinimumPerformanceService,
    private readonly currencyMapper: CurrencyMapperService,
    private readonly effectiveMetrics: PositionEffectiveMetricsService
  ) {}

  build(snapshot: PortfolioAppState): DecisionOpportunitiesViewModel {
    const minimumReview = this.buildMinimumBenchmarkReview(snapshot);
    const activatedAlerts = this.buildActivatedAlerts(snapshot.combinedAlerts ?? []);
    const misleadingPositions = this.buildMisleadingPositions(snapshot);

    return {
      minimumBenchmarkReview: minimumReview,
      activatedAlerts,
      misleadingPositions
    };
  }

  private buildMinimumBenchmarkReview(snapshot: PortfolioAppState): DecisionMinimumBenchmarkReview {
    const minimumBySymbol = this.minimumPerformanceService.buildMinimumPerformanceBySymbol(snapshot);
    const eligibleItems = minimumBySymbol
      .filter((item) => this.isReviewableMinimum(item))
      .sort((a, b) => (a.valueVsMinimumPercent ?? 0) - (b.valueVsMinimumPercent ?? 0));
    const items = eligibleItems
      .slice(0, 5)
      .map((item) => ({
        symbol: item.symbol,
        currency: item.currency,
        valueVsMinimumAmount: item.valueVsMinimumAmount ?? 0,
        valueVsMinimumPercent: item.valueVsMinimumPercent ?? 0,
        reason: this.minimumReason(item)
      }));

    const totalDeficitAmount = eligibleItems.reduce((sum, item) => sum + (item.valueVsMinimumAmount ?? 0), 0);
    const summary = this.minimumPerformanceService.buildMinimumPerformanceSummary(snapshot);

    return {
      totalBelowMinimum: eligibleItems.length,
      totalDeficitAmount,
      items,
      summary
    };
  }

  private buildActivatedAlerts(alerts: CombinedAlert[]): DecisionActivatedAlerts {
    const items = alerts
      .filter((alert) => this.isActivatedAlert(alert))
      .sort((a, b) => {
        const groupDiff = this.alertGroupRank(a.group) - this.alertGroupRank(b.group);
        if (groupDiff !== 0) {
          return groupDiff;
        }
        const distanceDiff = Math.abs(a.distancePercent ?? Infinity) - Math.abs(b.distancePercent ?? Infinity);
        if (distanceDiff !== 0) {
          return distanceDiff;
        }
        return String(a.symbol).localeCompare(String(b.symbol), 'es');
      })
      .slice(0, 5)
      .map((alert) => ({
        symbol: alert.symbol,
        group: alert.group,
        condition: this.alertCondition(alert),
        currentPrice: alert.currentPrice ?? null,
        targetPrice: alert.targetPrice ?? null,
        note: alert.note ?? null,
        status: alert.status,
        priority: alert.priority,
        distancePercent: alert.distancePercent ?? null
      }));

    return {
      total: items.length,
      items
    };
  }

  private buildMisleadingPositions(snapshot: PortfolioAppState): DecisionMisleadingPositionsReview {
    const positions = snapshot.dataset ? this.effectiveMetrics.buildEffectivePositions(snapshot) : [];
    const items = positions
      .filter((item) => this.isMisleadingPosition(item))
      .sort((a, b) => {
        const percentDiff = (a.minimumValueVsPercent ?? a.minimumValueVsAmount ?? 0) - (b.minimumValueVsPercent ?? b.minimumValueVsAmount ?? 0);
        if (percentDiff !== 0) {
          return percentDiff;
        }
        return (a.minimumValueVsAmount ?? 0) - (b.minimumValueVsAmount ?? 0);
      })
      .slice(0, 5)
      .map((item) => ({
        symbol: item.symbol,
        currency: item.currency,
        currentValue: item.position.currentValue,
        investedAmount: item.position.totalInvested,
        nominalResultAmount: item.nominalResultAmount ?? 0,
        nominalResultPercent: item.nominalResultPercent ?? 0,
        minimumExpectedValue: item.minimumExpectedValue ?? 0,
        comparableValue: item.minimumPerformance?.comparableValue ?? item.position.currentValue,
        valueVsMinimumAmount: item.minimumValueVsAmount ?? 0,
        valueVsMinimumPercent: item.minimumValueVsPercent ?? 0,
        note: this.misleadingPositionNote(item)
      }));

    return {
      total: items.length,
      items,
      note: 'Esta se\u00f1al no implica vender. Sirve para revisar activos que ganan nominalmente, pero pierden contra el costo de oportunidad.'
    };
  }

  private isReviewableMinimum(item: MinimumPerformanceBySymbol): boolean {
    if (item.currency !== 'ARS') {
      return false;
    }
    if (item.status !== 'below-minimum') {
      return false;
    }
    if (item.valueVsMinimumPercent === null || item.valueVsMinimumAmount === null) {
      return false;
    }

    return (
      item.valueVsMinimumPercent <= MINIMUM_BENCHMARK_REVIEW_PERCENT_THRESHOLD ||
      item.valueVsMinimumAmount <= MINIMUM_BENCHMARK_REVIEW_AMOUNT_THRESHOLD
    );
  }

  private minimumReason(item: MinimumPerformanceBySymbol): string {
    const percent = this.currencyMapper.formatPercentage(item.valueVsMinimumPercent);
    const amount = this.currencyMapper.formatCurrency(item.valueVsMinimumAmount, item.currency);
    if (item.usesAmortizationAdjustedBenchmark) {
      return `Est\u00e1 por debajo del benchmark ajustado (${percent} | ${amount}).`;
    }
    return `Est\u00e1 por debajo del benchmark m\u00ednimo (${percent} | ${amount}).`;
  }

  private isMisleadingPosition(item: EffectivePortfolioPosition): boolean {
    if (item.currency !== 'ARS') {
      return false;
    }
    if ((item.nominalResultAmount ?? 0) <= 0) {
      return false;
    }
    if (item.minimumPerformance === null || item.minimumExpectedValue === null) {
      return false;
    }
    if ((item.minimumValueVsAmount ?? 0) >= 0) {
      return false;
    }
    if (item.minimumValueVsPercent === null) {
      return false;
    }
    if (item.minimumPerformance.status !== 'below-minimum') {
      return false;
    }

    return this.isComparablePositionType(item);
  }

  private isComparablePositionType(item: EffectivePortfolioPosition): boolean {
    const normalized = `${item.position.positionType ?? ''} ${item.position.assetType ?? ''}`.toUpperCase();
    const symbol = String(item.symbol ?? '').trim().toUpperCase();
    const excludedSymbols = new Set(['CAUCION', 'CAUCI\u00d3N COLOCADORA', 'ADRDOLA', 'PRFAHOB', 'IOLCAMA', 'IOLCADO', 'IOLDOLD']);

    if (excludedSymbols.has(symbol)) {
      return false;
    }

    return !(
      normalized.includes('FCI') ||
      normalized.includes('VALORIZADO') ||
      normalized.includes('MONEY MARKET') ||
      normalized.includes('CAUCION')
    );
  }

  private misleadingPositionNote(item: EffectivePortfolioPosition): string {
    const nominal = this.currencyMapper.formatPercentage(item.nominalResultPercent);
    const vsMinimum = this.currencyMapper.formatPercentage(item.minimumValueVsPercent);
    return `Resultado nominal ${nominal} pero vs m\u00ednimo ${vsMinimum}.`;
  }

  private isActivatedAlert(alert: CombinedAlert): boolean {
    if (alert.group === 'signal') {
      return false;
    }

    const status = String(alert.status ?? '').toLowerCase();
    return status.includes('activad') || status.includes('activated');
  }

  private alertCondition(alert: CombinedAlert): string {
    const status = String(alert.status ?? '').trim();
    if (status) {
      return status;
    }
    if (alert.group === 'manual') {
      return 'Manual';
    }
    if (alert.group === 'calculated') {
      return 'Calculada';
    }
    return 'Activada';
  }

  private alertGroupRank(group: string): number {
    switch (group) {
      case 'manual':
        return 0;
      case 'calculated':
        return 1;
      default:
        return 2;
    }
  }
}
