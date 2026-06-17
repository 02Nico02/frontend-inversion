import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardSummaryPanelComponent } from '../../../../dashboard-summary-panel/dashboard-summary-panel.component';
import { MinimumPerformanceSummary } from '../../../../core/models/minimum-performance.model';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioHealthService } from '../../../../core/services/portfolio-health.service';
import { PortfolioConcentrationService } from '../../../../core/services/portfolio-concentration.service';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { MinimumPerformanceService } from '../../../../core/services/minimum-performance.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardSummaryPanelComponent],
  templateUrl: './summary-page.component.html',
  styleUrls: ['./summary-page.component.scss'],
})
export class SummaryPageComponent {
  constructor(
    public readonly state: PortfolioStateService,
    private readonly healthService: PortfolioHealthService,
    private readonly concentrationService: PortfolioConcentrationService,
    private readonly currencyMapper: CurrencyMapperService,
    private readonly minimumPerformanceService: MinimumPerformanceService
  ) {}

  healthSummary(snapshot: PortfolioAppState) {
    return snapshot.dataset && snapshot.workbook ? this.healthService.buildReport(snapshot.dataset, snapshot.workbook.validation).summary : {
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

  percent(value: number): string {
    return this.currencyMapper.formatPercentage(value);
  }
}
