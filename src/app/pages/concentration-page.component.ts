import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../shared/components/simple-chart.component';
import { PortfolioStateService } from '../core/services/portfolio-state.service';
import { PortfolioConcentrationService } from '../core/services/portfolio-concentration.service';
import { PortfolioCalculatorService } from '../core/services/portfolio-calculator.service';
import { CurrencyMapperService, CanonicalCurrency } from '../core/services/currency-mapper.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Concentración</p>
          <h2>Top 1 / 3 / 5 / 10 y ranking principal</h2>
        </div>
      </header>

      <ng-container *ngIf="snapshot.dataset; else emptyState">
        <div class="filters">
          <label>
            <span>Moneda</span>
            <select [(ngModel)]="currencyFilter">
              <option value="ALL">Sin conversión</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>

        <article class="panel warning" *ngIf="report(snapshot).currencyWarning">
          {{ report(snapshot).currencyWarning }}
        </article>

        <div class="metrics">
          <article class="panel"><strong>Top 1</strong><span>{{ percent(report(snapshot).top1Percent) }}</span></article>
          <article class="panel"><strong>Top 3</strong><span>{{ percent(report(snapshot).top3Percent) }}</span></article>
          <article class="panel"><strong>Top 5</strong><span>{{ percent(report(snapshot).top5Percent) }}</span></article>
          <article class="panel"><strong>Top 10</strong><span>{{ percent(report(snapshot).top10Percent) }}</span></article>
        </div>

        <app-simple-chart title="Concentración" subtitle="Top 1 / Top 3 / Top 5 / Top 10" mode="line" [points]="chartSeries(snapshot)" currency="UNKNOWN" valueKind="percent" [showAverage]="false"></app-simple-chart>

        <section class="panel">
          <h3>Ranking</h3>
          <div class="ranking">
            <div class="row head"><span>#</span><span>Especie</span><span>Moneda</span><span>Total</span><span>Peso %</span><span>Acum. %</span></div>
            <div class="row" *ngFor="let item of report(snapshot).ranking | slice:0:10">
              <span>{{ item.rank }}</span>
              <span>{{ item.symbol }}</span>
              <span>{{ item.currency }}</span>
              <span>{{ formatMoney(item.totalCurrentValue, item.currency) }}</span>
              <span>{{ percent(item.weightPercent) }}</span>
              <span>{{ percent(item.cumulativeWeightPercent) }}</span>
            </div>
          </div>
        </section>
      </ng-container>

      <ng-template #emptyState>
        <article class="panel">
          <h3>No hay datos cargados</h3>
          <p>Importá el Excel para ver la concentración.</p>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; }
    .page-header .eyebrow { margin: 0; color: var(--brand); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; }
    .page-header h2, .panel h3 { margin: 0.2rem 0 0; }
    .panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1rem; }
    .warning { color: var(--warn); }
    .filters { display: flex; gap: 0.75rem; }
    .filters label { display: grid; gap: 0.3rem; color: var(--muted); font-size: 0.84rem; }
    .filters select { background: rgba(255,255,255,0.04); color: var(--text); border: 1px solid var(--panel-border); border-radius: 12px; padding: 0.6rem 0.8rem; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
    .metrics .panel { display: grid; gap: 0.2rem; }
    .metrics span { font-size: 1.2rem; font-weight: 700; }
    .ranking { display: grid; gap: 0.35rem; }
    .row { display: grid; grid-template-columns: 40px 1fr 80px 140px 90px 90px; gap: 0.5rem; padding: 0.55rem 0.7rem; background: rgba(255,255,255,0.03); border-radius: 12px; }
    .head { background: transparent; color: var(--muted); }
    @media (max-width: 900px) {
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
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

  formatMoney(value: number, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
  }
}
