import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { ChartDataService } from '../../../../core/services/chart-data.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { CurrencyMapperService, CanonicalCurrency } from '../../../../core/services/currency-mapper.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './distribution-page.component.html',
  styleUrls: ['./distribution-page.component.scss'],
})
export class DistributionPageComponent {
  currencyFilter: CanonicalCurrency | 'ALL' = 'ALL';
  topN = 10;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly chartData: ChartDataService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  get currencyForCharts(): string {
    return this.currencyFilter === 'ALL' ? 'UNKNOWN' : this.currencyFilter;
  }

  private visiblePositions(snapshot: PortfolioAppState) {
    return snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
  }

  symbolDistribution(snapshot: PortfolioAppState) {
    return this.chartData.distributionBySymbol(this.visiblePositions(snapshot), this.currencyFilter, this.topN);
  }

  currencyDistribution(snapshot: PortfolioAppState) {
    return this.chartData.distributionByCurrency(this.visiblePositions(snapshot), this.currencyFilter);
  }

  assetTypeDistribution(snapshot: PortfolioAppState) {
    return this.chartData.distributionByAssetType(this.visiblePositions(snapshot), this.currencyFilter);
  }

  sectorDistribution(snapshot: PortfolioAppState) {
    return this.chartData.distributionBySector(this.visiblePositions(snapshot), this.currencyFilter);
  }

  subsectorDistribution(snapshot: PortfolioAppState) {
    return this.chartData.distributionBySubsector(this.visiblePositions(snapshot), this.currencyFilter);
  }

  regionDistribution(snapshot: PortfolioAppState) {
    return this.chartData.distributionByRegion(this.visiblePositions(snapshot), this.currencyFilter);
  }
}
