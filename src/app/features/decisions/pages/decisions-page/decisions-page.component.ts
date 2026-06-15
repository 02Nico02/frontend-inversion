import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { DecisionInsightsService } from '../../services/decision-insights.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './decisions-page.component.html',
  styleUrls: ['./decisions-page.component.scss']
})
export class DecisionsPageComponent {
  monthlyContribution = 100000;
  months = 12;
  annualReturnPercent = 15;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly insights: DecisionInsightsService
  ) {}

  model(snapshot: PortfolioAppState) {
    return this.insights.build(snapshot, this.monthlyContribution, this.months, this.annualReturnPercent);
  }

  trackByItem(index: number, item: { label?: unknown; symbol?: unknown; title?: unknown }): string {
    return String(item.label ?? item.symbol ?? item.title ?? index);
  }
}
