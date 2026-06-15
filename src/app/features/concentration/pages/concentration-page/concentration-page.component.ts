import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioConcentrationService } from '../../../../core/services/portfolio-concentration.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { CurrencyMapperService, CanonicalCurrency } from '../../../../core/services/currency-mapper.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './concentration-page.component.html',
  styleUrls: ['./concentration-page.component.scss'],
})
export class ConcentrationPageComponent {
  currencyFilter: CanonicalCurrency | 'ALL' = 'ALL';

  constructor(
    public readonly state: PortfolioStateService,
    private readonly concentrationService: PortfolioConcentrationService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  report(snapshot: any) {
    const scope: 'ALL' | 'ARS' | 'USD' = this.currencyFilter === 'ARS' || this.currencyFilter === 'USD' ? this.currencyFilter : 'ALL';
    const positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    return this.concentrationService.buildReport(positions, scope);
  }

  chartSeries(snapshot: any) {
    const report = this.report(snapshot);
    return [
      { label: 'Top 1', value: report.top1Percent },
      { label: 'Top 3', value: report.top3Percent },
      { label: 'Top 5', value: report.top5Percent },
      { label: 'Top 10', value: report.top10Percent }
    ];
  }

  percent(value: number): string {
    return this.currencyMapper.formatPercentage(value);
  }

  number(value: number | null | undefined): string {
    return this.currencyMapper.formatNumber(value);
  }

  formatMoney(value: number, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
  }
}
