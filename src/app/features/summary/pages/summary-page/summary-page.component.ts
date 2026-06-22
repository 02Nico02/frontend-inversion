import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardSummaryPanelComponent } from '../../../../dashboard-summary-panel/dashboard-summary-panel.component';
import { MinimumPerformanceSummary } from '../../../../core/models/minimum-performance.model';
import { PortfolioUpcomingMilestone, PortfolioUpcomingMilestoneBreakdown } from '../../../../core/models/portfolio-upcoming-milestone.model';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioHealthService } from '../../../../core/services/portfolio-health.service';
import { PortfolioConcentrationService } from '../../../../core/services/portfolio-concentration.service';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { MinimumPerformanceService } from '../../../../core/services/minimum-performance.service';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';
import { PortfolioUpcomingMilestonesService } from '../../../../core/services/portfolio-upcoming-milestones.service';
import { PortfolioMinimumBalanceTrendService } from '../../../../core/services/portfolio-minimum-balance-trend.service';
import { MinimumBalanceTrendSummary } from '../../../../core/models/portfolio-minimum-balance-trend.model';
import { PendingOrdersSummary } from '../../../../core/models/pending-orders.model';
import { PendingOrdersPanelComponent } from '../../../../shared/components/pending-orders-panel/pending-orders-panel.component';

const UPCOMING_CONTRIBUTION_KEY = 'summary.upcomingGoals.monthlyContributionArs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DashboardSummaryPanelComponent, PendingOrdersPanelComponent],
  templateUrl: './summary-page.component.html',
  styleUrls: ['./summary-page.component.scss'],
})
export class SummaryPageComponent {
  upcomingContributionArs = this.loadUpcomingContribution();

  private cachedUpcomingGoalsKey = '';
  private cachedUpcomingGoals: PortfolioUpcomingMilestone[] = [];
  private cachedMinimumBalanceTrendKey = '';
  private cachedMinimumBalanceTrend: MinimumBalanceTrendSummary = {
    currentBalanceVsMinimumARS: null,
    currentBalanceVsMinimumPercent: null,
    bestHistoricalBalanceARS: null,
    bestHistoricalDate: null,
    worstHistoricalBalanceARS: null,
    worstHistoricalDate: null,
    change30dARS: null,
    change90dARS: null,
    change30dPercentPoints: null,
    change90dPercentPoints: null,
    trendStatus: 'not-available',
    trendLabel: 'Sin historial suficiente',
    positionsBelowMinimumCount: 0,
    totalDeficitBelowMinimumARS: 0,
    points: [],
    source: 'MinimumPerformanceService',
    warnings: []
  };

  constructor(
    public readonly state: PortfolioStateService,
    private readonly healthService: PortfolioHealthService,
    private readonly concentrationService: PortfolioConcentrationService,
    private readonly currencyMapper: CurrencyMapperService,
    private readonly minimumPerformanceService: MinimumPerformanceService,
    private readonly upcomingMilestonesService: PortfolioUpcomingMilestonesService,
    private readonly minimumBalanceTrendService: PortfolioMinimumBalanceTrendService,
    public readonly privacyMode: PrivacyModeService
  ) {}

  healthSummary(snapshot: PortfolioAppState) {
    return snapshot.dataset && snapshot.workbook
      ? this.healthService.buildReport(snapshot.dataset, snapshot.workbook.validation).summary
      : {
          criticalProblems: 0,
          warnings: 0,
          uncategorizedAssets: 0,
          assetsWithoutHistory: 0,
          alertsToReview: 0,
          incompleteSignals: 0,
          strategicSplitIssues: 0,
          status: 'ok' as const
        };
  }

  concentration(snapshot: PortfolioAppState) {
    const positions = snapshot.dataset?.positions ?? [];
    return this.concentrationService.buildReport(positions, 'ALL');
  }

  minimumPerformanceSummary(snapshot: PortfolioAppState): MinimumPerformanceSummary {
    return this.minimumPerformanceService.buildMinimumPerformanceSummary(snapshot);
  }

  minimumBalanceTrend(snapshot: PortfolioAppState): MinimumBalanceTrendSummary {
    const cacheKey = [
      snapshot.importedAt ?? '',
      snapshot.fileName ?? '',
      snapshot.dataset?.operations.length ?? 0,
      snapshot.dataset?.positions.length ?? 0,
      snapshot.dataset?.investmentMovements.length ?? 0,
      snapshot.dataset?.calendarBenchmarks.length ?? 0
    ].join('|');

    if (cacheKey === this.cachedMinimumBalanceTrendKey) {
      return this.cachedMinimumBalanceTrend;
    }

    this.cachedMinimumBalanceTrend = this.minimumBalanceTrendService.buildTrend(snapshot);
    this.cachedMinimumBalanceTrendKey = cacheKey;
    return this.cachedMinimumBalanceTrend;
  }

  minimumPerformanceStatusLabel(status: MinimumPerformanceSummary['status']): string {
    switch (status) {
      case 'positive':
        return 'Supera el mínimo esperado';
      case 'negative':
        return 'Debajo del mínimo esperado';
      case 'neutral':
        return 'En línea con el mínimo esperado';
      case 'missing':
      default:
        return 'Sin datos suficientes';
    }
  }

  minimumPerformanceStatusClass(status: MinimumPerformanceSummary['status']): string {
    switch (status) {
      case 'positive':
        return 'positive';
      case 'negative':
        return 'negative';
      case 'neutral':
        return 'neutral';
      case 'missing':
      default:
        return 'missing';
    }
  }

  percent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  upcomingGoals(snapshot: PortfolioAppState): PortfolioUpcomingMilestone[] {
    const cacheKey = [
      snapshot.importedAt ?? '',
      snapshot.fileName ?? '',
      snapshot.dataset?.monthlySummary.length ?? 0,
      snapshot.dataset?.strategicSplit.length ?? 0,
      snapshot.summary?.byCurrency.map((item) => `${item.currency}:${item.totalCurrentValue}`).join('|') ?? '',
      this.upcomingContributionArs ?? ''
    ].join('|');

    if (cacheKey === this.cachedUpcomingGoalsKey) {
      return this.cachedUpcomingGoals;
    }

    this.cachedUpcomingGoals = this.upcomingMilestonesService.buildUpcomingMilestones(snapshot, this.upcomingContributionArs);
    this.cachedUpcomingGoalsKey = cacheKey;
    return this.cachedUpcomingGoals;
  }

  goalStatusLabel(status: PortfolioUpcomingMilestone['status']): string {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'reached':
        return 'Alcanzado';
      case 'not-available':
      default:
        return 'No disponible';
    }
  }

  goalStatusBadge(goal: PortfolioUpcomingMilestone): string {
    return goal.category === 'strategy-balance' ? 'Guía' : this.goalStatusLabel(goal.status);
  }

  goalCategoryLabel(category: PortfolioUpcomingMilestone['category']): string {
    switch (category) {
      case 'portfolio-value':
        return 'Valor del portafolio';
      case 'historical-recovery':
        return 'Recuperación';
      case 'strategy-balance':
        return 'Estrategia';
      case 'manual-goal':
        return 'Meta manual';
      default:
        return 'Objetivo';
    }
  }

  goalCurrencyLabel(currency: 'ARS' | 'USD'): string {
    return currency;
  }

  goalAmount(value: number | null | undefined, currency: 'ARS' | 'USD' | null): string {
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    if (value === null || value === undefined || currency === null) {
      return 'N/D';
    }
    return this.currencyMapper.formatCurrency(value, currency);
  }

  goalPercent(value: number | null | undefined): string {
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    if (value === null || value === undefined) {
      return 'N/D';
    }
    return this.currencyMapper.formatPercentage(value);
  }

  goalMonths(value: number | null | undefined): string {
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    if (value === null || value === undefined) {
      return 'N/D';
    }
    return `${value} mes${value === 1 ? '' : 'es'}`;
  }

  pendingOrders(snapshot: PortfolioAppState): PendingOrdersSummary | null {
    return snapshot.dataset?.pendingOrders ?? null;
  }

  strategyReferenceSummary(goal: PortfolioUpcomingMilestone): string {
    if (!goal.breakdown?.length) {
      return 'N/D';
    }

    return goal.breakdown
      .map((item) => {
        const retirement = this.goalPercent(item.retirementPercent);
        const savings = this.goalPercent(item.savingsPercent);
        return `Jubilación ${retirement} / Ahorro ${savings}`;
      })
      .join(' · ');
  }

  strategyReferenceDetail(goal: PortfolioUpcomingMilestone): string {
    if (!goal.breakdown?.length) {
      return 'No hay datos de distribución acumulada.';
    }
    return 'La referencia surge de los aportes y egresos acumulados en Tabla35. Sirve como guía para futuros aportes, no como obligación de rebalanceo por rendimiento.';
  }

  strategyBreakdownLabel(item: PortfolioUpcomingMilestoneBreakdown): string {
    const retirement = this.goalPercent(item.retirementPercent);
    const savings = this.goalPercent(item.savingsPercent);
    return `Jubilación ${retirement} / Ahorro ${savings}`;
  }

  strategySavingsPercent(breakdown: PortfolioUpcomingMilestoneBreakdown): string {
    if (this.privacyMode.enabled || breakdown.savingsPercent === null || breakdown.savingsPercent === undefined) {
      return 'Oculto';
    }
    return this.goalPercent(breakdown.savingsPercent);
  }

  persistUpcomingContribution(value: string | number | null): void {
    const numeric = typeof value === 'number' ? value : Number(value ?? NaN);
    this.upcomingContributionArs = Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (this.upcomingContributionArs === null) {
      localStorage.removeItem(UPCOMING_CONTRIBUTION_KEY);
      return;
    }
    localStorage.setItem(UPCOMING_CONTRIBUTION_KEY, String(this.upcomingContributionArs));
  }

  private loadUpcomingContribution(): number | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(UPCOMING_CONTRIBUTION_KEY);
    const parsed = raw !== null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
}



