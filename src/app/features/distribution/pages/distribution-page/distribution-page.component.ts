import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { ChartDataService } from '../../../../core/services/chart-data.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { CurrencyMapperService, CanonicalCurrency } from '../../../../core/services/currency-mapper.service';
import { StrategicSectorObjective } from '../../../../core/models/portfolio.models';

interface StrategicObjectiveRow extends StrategicSectorObjective {
  status: 'Falta peso' | 'Sobrepeso' | 'En rango' | 'Sin datos';
}

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

  strategicRows(snapshot: PortfolioAppState): StrategicObjectiveRow[] {
    return [...(snapshot.dataset?.strategicSectorObjectives ?? [])]
      .filter((item) => String(item.macroSector ?? '').trim().toLowerCase() !== 'total')
      .map((item) => ({
        ...item,
        status: this.strategicObjectiveStatus(item.differencePercent)
      }))
      .sort((a, b) => Math.abs(b.differencePercent ?? 0) - Math.abs(a.differencePercent ?? 0));
  }

  strategicObjectiveRows(snapshot: PortfolioAppState): StrategicObjectiveRow[] {
    return this.strategicRows(snapshot);
  }

  strategicReinforcementRows(snapshot: PortfolioAppState): StrategicObjectiveRow[] {
    return this.strategicRows(snapshot)
      .filter((item) => (item.differencePercent ?? 0) > 0.5)
      .slice(0, 3);
  }

  strategicOverweightRows(snapshot: PortfolioAppState): StrategicObjectiveRow[] {
    return this.strategicRows(snapshot)
      .filter((item) => (item.differencePercent ?? 0) < -0.5)
      .slice(0, 3);
  }

  strategicComparisonMax(snapshot: PortfolioAppState): number {
    const values = this.strategicRows(snapshot)
      .flatMap((row) => [row.targetPercent, row.currentPercent])
      .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

    return Math.max(1, ...values);
  }

  strategicBarWidth(value: number | null, max: number): number {
    if (value === null || value === undefined || !Number.isFinite(value) || max <= 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, (value / max) * 100));
  }

  strategicObjectiveStatus(differencePercent: number | null): StrategicObjectiveRow['status'] {
    if (differencePercent === null || differencePercent === undefined || Number.isNaN(differencePercent)) {
      return 'Sin datos';
    }
    if (differencePercent > 0.5) {
      return 'Falta peso';
    }
    if (differencePercent < -0.5) {
      return 'Sobrepeso';
    }
    return 'En rango';
  }

  absolutePercent(value: number | null | undefined): number | null {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return null;
    }
    return Math.abs(value);
  }
}
