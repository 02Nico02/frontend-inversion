import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { PortfolioStateService, PortfolioAppState } from '../../../../core/services/portfolio-state.service';
import { PortfolioMilestonesService } from '../../../../core/services/portfolio-milestones.service';
import {
  PortfolioMilestone,
  PortfolioMilestoneBuildResult,
  PortfolioMilestoneCategory,
  PortfolioUnavailableMilestone
} from '../../../../core/models/portfolio-milestones.model';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';
import { parseExcelDate } from '../../../../core/utils/value-parsing.utils';

const UPCOMING_CONTRIBUTION_KEY = 'summary.upcomingGoals.monthlyContributionArs';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './historical-milestones-page.component.html',
  styleUrls: ['./historical-milestones-page.component.scss']
})
export class HistoricalMilestonesPageComponent {
  private cachedReportKey = '';
  private cachedReport: PortfolioMilestoneBuildResult = { detected: [], unavailable: [] };
  readonly backLink = '/historico';
  upcomingContributionArs = this.loadUpcomingContribution();

  constructor(
    public readonly state: PortfolioStateService,
    private readonly milestonesService: PortfolioMilestonesService,
    private readonly currencyMapper: CurrencyMapperService,
    public readonly privacyMode: PrivacyModeService
  ) {}

  milestoneReport(snapshot: PortfolioAppState): PortfolioMilestoneBuildResult {
    const cacheKey = [
      snapshot.importedAt ?? '',
      snapshot.fileName ?? '',
      snapshot.dataset?.dailyBalances.length ?? 0,
      snapshot.dataset?.monthlySummary.length ?? 0,
      this.upcomingContributionArs ?? ''
    ].join('|');

    if (cacheKey === this.cachedReportKey) {
      return this.cachedReport;
    }

    this.cachedReport = this.milestonesService.buildMilestoneReportWithContribution(snapshot, this.upcomingContributionArs);
    this.cachedReportKey = cacheKey;
    return this.cachedReport;
  }

  completedMilestones(snapshot: PortfolioAppState): PortfolioMilestone[] {
    return this.milestoneReport(snapshot).detected;
  }

  pendingMilestones(snapshot: PortfolioAppState): PortfolioUnavailableMilestone[] {
    return this.milestoneReport(snapshot).unavailable;
  }

  completedMilestoneGroups(snapshot: PortfolioAppState): Array<{ category: PortfolioMilestoneCategory; label: string; items: PortfolioMilestone[] }> {
    const items = this.completedMilestones(snapshot);
    return this.milestonesService.getCategoryOrder()
      .map((category) => ({
        category,
        label: this.milestonesService.getCategoryLabel(category),
        items: items.filter((item) => item.category === category)
      }))
      .filter((group) => group.items.length > 0);
  }

  pendingMilestoneGroups(snapshot: PortfolioAppState): Array<{ category: PortfolioMilestoneCategory; label: string; items: PortfolioUnavailableMilestone[] }> {
    const items = this.pendingMilestones(snapshot);
    return this.milestonesService.getCategoryOrder()
      .map((category) => ({
        category,
        label: this.milestonesService.getCategoryLabel(category),
        items: items.filter((item) => item.category === category)
      }))
      .filter((group) => group.items.length > 0);
  }

  latestCompletedMilestone(snapshot: PortfolioAppState): PortfolioMilestone | null {
    return this.milestonesService.getLatestMilestone(this.completedMilestones(snapshot));
  }

  milestoneDate(value: string | Date | null): string {
    if (!value) {
      return 'N/D';
    }

    const date = value instanceof Date ? value : parseExcelDate(value);
    if (!date || Number.isNaN(date.getTime())) {
      return 'N/D';
    }

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  milestoneValue(milestone: PortfolioMilestone): string {
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    if (milestone.value !== null && milestone.currency) {
      return this.currencyMapper.formatCurrency(milestone.value, milestone.currency);
    }
    if (milestone.value !== null) {
      return this.currencyMapper.formatNumber(milestone.value);
    }
    if (milestone.percent !== null) {
      return this.currencyMapper.formatPercentage(milestone.percent);
    }
    return 'N/D';
  }

  milestoneSeverityLabel(severity: PortfolioMilestone['severity']): string {
    switch (severity) {
      case 'positive':
        return 'Positivo';
      case 'negative':
        return 'Negativo';
      case 'neutral':
        return 'Neutro';
      case 'warning':
        return 'Aviso';
      default:
        return 'Hito';
    }
  }

  milestoneCategoryLabel(category: PortfolioMilestone['category']): string {
    return this.milestonesService.getCategoryLabel(category);
  }

  milestoneTooltip(milestone: PortfolioMilestone): string {
    const parts = [milestone.description, this.milestoneSourceLabel(milestone.source)];
    if (milestone.percent !== null && milestone.percent !== undefined) {
      parts.push(`Referencia porcentual: ${this.currencyMapper.formatPercentage(milestone.percent)}`);
    }
    return parts.join(' - ');
  }

  pendingTooltip(item: PortfolioUnavailableMilestone): string {
    const parts = [item.description];
    if (item.requiredSource) {
      parts.push(this.unavailableMilestoneSourceLabel(item.requiredSource));
    }
    return parts.join(' - ');
  }

  pendingReferenceLabel(item: PortfolioUnavailableMilestone): string {
    return this.unavailableMilestoneSourceLabel(item.requiredSource) || 'Sin referencia requerida';
  }

  pendingLabel(item: PortfolioUnavailableMilestone): string {
    return item.reason === 'not-reached' ? 'Pendiente' : item.reason === 'missing-data' ? 'Sin datos' : 'No disponible';
  }

  totalDetected(snapshot: PortfolioAppState): number {
    return this.completedMilestones(snapshot).length;
  }

  totalPending(snapshot: PortfolioAppState): number {
    return this.pendingMilestones(snapshot).length;
  }

  private loadUpcomingContribution(): number | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(UPCOMING_CONTRIBUTION_KEY);
    const parsed = raw !== null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private milestoneSourceLabel(source: string): string {
    const normalized = source.trim().toLowerCase();
    if (!normalized) {
      return '';
    }
    if (normalized.includes('historialmensualreconstruido')) {
      return 'Referencia histórica del portafolio';
    }
    if (normalized.includes('portfolio')) {
      return 'Referencia histórica del portafolio';
    }
    return 'Referencia histórica';
  }

  private unavailableMilestoneSourceLabel(source: string | null | undefined): string {
    if (!source) {
      return '';
    }
    const normalized = source.trim().toLowerCase();
    if (!normalized) {
      return '';
    }
    if (normalized.includes('benchmark')) {
      return 'Referencia del benchmark mínimo';
    }
    if (normalized.includes('historialmensualreconstruido')) {
      return 'Referencia histórica del portafolio';
    }
    return 'Referencia histórica';
  }
}

