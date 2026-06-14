import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../shared/components/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../core/services/portfolio-state.service';
import { ChartDataService } from '../core/services/chart-data.service';
import { PortfolioCalculatorService } from '../core/services/portfolio-calculator.service';
import { CurrencyMapperService, CanonicalCurrency } from '../core/services/currency-mapper.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Distribución</p>
          <h2>Composición del portafolio</h2>
          <p class="lead">Reparte el portafolio por especie, moneda, tipo de activo, sector, subsector y región.</p>
        </div>
        <div class="filters" *ngIf="snapshot.dataset">
          <label>
            <span>Moneda</span>
            <select [(ngModel)]="currencyFilter">
              <option value="ALL">Sin conversión</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label>
            <span>Top N</span>
            <select [(ngModel)]="topN">
              <option [ngValue]="5">Top 5</option>
              <option [ngValue]="10">Top 10</option>
              <option [ngValue]="15">Top 15</option>
              <option [ngValue]="20">Top 20</option>
            </select>
          </label>
        </div>
      </header>

      <p class="warning" *ngIf="currencyFilter === 'ALL' && snapshot.dataset">
        Sin conversión mezcla ARS y USD solo como referencia visual.
      </p>

      <ng-container *ngIf="snapshot.dataset; else emptyState">
        <section class="grid">
          <app-simple-chart title="Distribución" subtitle="Por especie" mode="bars" [points]="symbolDistribution(snapshot)" [currency]="currencyForCharts"></app-simple-chart>
          <app-simple-chart title="Distribución" subtitle="Por moneda" mode="bars" [points]="currencyDistribution(snapshot)" currency="UNKNOWN" [topN]="topN"></app-simple-chart>
          <app-simple-chart title="Categorías" subtitle="Por tipo de activo" mode="bars" [points]="assetTypeDistribution(snapshot)" [currency]="currencyForCharts" [topN]="topN"></app-simple-chart>
          <app-simple-chart title="Categorías" subtitle="Por sector" mode="bars" [points]="sectorDistribution(snapshot)" [currency]="currencyForCharts" [topN]="topN"></app-simple-chart>
          <app-simple-chart title="Categorías" subtitle="Por subsector" mode="bars" [points]="subsectorDistribution(snapshot)" [currency]="currencyForCharts" [topN]="topN"></app-simple-chart>
          <app-simple-chart title="Categorías" subtitle="Por región" mode="bars" [points]="regionDistribution(snapshot)" [currency]="currencyForCharts" [topN]="topN"></app-simple-chart>
        </section>
      </ng-container>

      <ng-template #emptyState>
        <article class="panel empty">
          <h3>No hay datos cargados</h3>
          <p>Importá el Excel para ver la distribución del portafolio.</p>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page {
      display: grid;
      gap: 1rem;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: end;
      flex-wrap: wrap;
    }
    .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
    }
    h2 {
      margin: 0.2rem 0 0;
    }
    .lead, .warning {
      color: var(--muted);
      margin: 0.35rem 0 0;
    }
    .warning {
      color: var(--warn);
    }
    .filters {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .filters label {
      display: grid;
      gap: 0.3rem;
      color: var(--muted);
      font-size: 0.84rem;
    }
    .filters select {
      background: rgba(255,255,255,0.04);
      color: var(--text);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 0.6rem 0.8rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1rem;
    }
    @media (max-width: 1100px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `]
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
