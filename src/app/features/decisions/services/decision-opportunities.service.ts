import { Injectable } from '@angular/core';
import { MinimumPerformanceBySymbol, MinimumPerformanceSummary } from '../../../core/models/minimum-performance.model';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { MinimumPerformanceService } from '../../../core/services/minimum-performance.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';

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

export interface DecisionOpportunitiesViewModel {
  minimumBenchmarkReview: DecisionMinimumBenchmarkReview;
  activatedAlerts: DecisionActivatedAlerts;
}

const MINIMUM_BENCHMARK_REVIEW_PERCENT_THRESHOLD = -5;
const MINIMUM_BENCHMARK_REVIEW_AMOUNT_THRESHOLD = -10000;

@Injectable({ providedIn: 'root' })
export class DecisionOpportunitiesService {
  constructor(
    private readonly minimumPerformanceService: MinimumPerformanceService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  build(snapshot: PortfolioAppState): DecisionOpportunitiesViewModel {
    const minimumReview = this.buildMinimumBenchmarkReview(snapshot);
    const activatedAlerts = this.buildActivatedAlerts(snapshot.combinedAlerts ?? []);

    return {
      minimumBenchmarkReview: minimumReview,
      activatedAlerts
    };
  }

  private buildMinimumBenchmarkReview(snapshot: PortfolioAppState): DecisionMinimumBenchmarkReview {
    const minimumBySymbol = this.minimumPerformanceService.buildMinimumPerformanceBySymbol(snapshot);
    const items = minimumBySymbol
      .filter((item) => this.isReviewableMinimum(item))
      .sort((a, b) => (a.valueVsMinimumPercent ?? 0) - (b.valueVsMinimumPercent ?? 0))
      .slice(0, 5)
      .map((item) => ({
        symbol: item.symbol,
        currency: item.currency,
        valueVsMinimumAmount: item.valueVsMinimumAmount ?? 0,
        valueVsMinimumPercent: item.valueVsMinimumPercent ?? 0,
        reason: this.minimumReason(item)
      }));

    const totalDeficitAmount = items.reduce((sum, item) => sum + item.valueVsMinimumAmount, 0);
    const summary = this.minimumPerformanceService.buildMinimumPerformanceSummary(snapshot);

    return {
      totalBelowMinimum: items.length,
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
      return `Está por debajo del benchmark ajustado (${percent} | ${amount}).`;
    }
    return `Está por debajo del benchmark mínimo (${percent} | ${amount}).`;
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
