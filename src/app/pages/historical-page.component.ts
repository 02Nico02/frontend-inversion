import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HistoricalSymbolComboboxComponent, HistoricalSymbolOption } from '../shared/components/historical-symbol-combobox.component';
import { SimpleChartComponent } from '../shared/components/simple-chart.component';
import { PortfolioStateService } from '../core/services/portfolio-state.service';
import { PortfolioCalculatorService } from '../core/services/portfolio-calculator.service';
import { ChartDataService } from '../core/services/chart-data.service';
import { CurrencyMapperService } from '../core/services/currency-mapper.service';
import { PortfolioAppState } from '../core/services/portfolio-state.service';
import { parseExcelDate } from '../core/utils/value-parsing.utils';

type DatePeriod = 'ALL' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'CUSTOM';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, HistoricalSymbolComboboxComponent, SimpleChartComponent],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Histórico</p>
          <h2>Precio histórico y evolución diaria</h2>
          <p class="lead">Elegí una especie para revisar su serie y comparar contra la evolución diaria del workbook.</p>
        </div>
      </header>

      <ng-container *ngIf="snapshot.dataset; else emptyState">
        <section class="panel">
          <div class="toolbar">
            <app-historical-symbol-combobox
              [options]="historicalSpeciesOptions(snapshot)"
              [(selectedSymbol)]="selectedHistoricalSymbol"
            ></app-historical-symbol-combobox>
            <label class="period">
              <span>Período</span>
              <select [(ngModel)]="pricePeriod">
                <option value="ALL">Todo</option>
                <option value="1M">1M</option>
                <option value="3M">3M</option>
                <option value="6M">6M</option>
                <option value="YTD">YTD</option>
                <option value="1Y">1A</option>
                <option value="CUSTOM">Personalizado</option>
              </select>
            </label>
          </div>

          <div class="date-range" *ngIf="pricePeriod === 'CUSTOM'">
            <label><span>Desde</span><input type="date" [(ngModel)]="priceRangeStart" /></label>
            <label><span>Hasta</span><input type="date" [(ngModel)]="priceRangeEnd" /></label>
          </div>

          <app-simple-chart title="Precio histórico" [subtitle]="selectedHistoricalLabel(snapshot)" mode="line" [points]="historicalPriceSeries(snapshot)" [currency]="selectedHistoricalCurrency(snapshot)" valueKind="money"></app-simple-chart>

          <div class="stats-row" *ngIf="historicalPriceStats(snapshot) as stats">
            <span>Desde: {{ stats.startDate || 'N/D' }}</span>
            <span>Hasta: {{ stats.endDate || 'N/D' }}</span>
            <span>Inicial: {{ formatNumber(stats.initial) }}</span>
            <span>Final: {{ formatNumber(stats.final) }}</span>
            <span>Var: {{ formatNumber(stats.variationAmount) }}</span>
            <span>Var %: {{ percent(stats.variationPercent) }}</span>
          </div>
        </section>

        <section class="panel">
          <div class="title-row">
            <div>
              <p class="eyebrow">Evolución diaria</p>
              <h3>Serie de evolución</h3>
            </div>
            <label class="period">
              <span>Período</span>
              <select [(ngModel)]="balancePeriod">
                <option value="ALL">Todo</option>
                <option value="1M">1M</option>
                <option value="3M">3M</option>
                <option value="6M">6M</option>
                <option value="YTD">YTD</option>
                <option value="1Y">1A</option>
                <option value="CUSTOM">Personalizado</option>
              </select>
            </label>
          </div>
          <div class="date-range" *ngIf="balancePeriod === 'CUSTOM'">
            <label><span>Desde</span><input type="date" [(ngModel)]="balanceRangeStart" /></label>
            <label><span>Hasta</span><input type="date" [(ngModel)]="balanceRangeEnd" /></label>
          </div>
          <app-simple-chart title="Evolución diaria" subtitle="Serie histórica" mode="line" [points]="balanceSeries(snapshot)" currency="UNKNOWN" valueKind="money"></app-simple-chart>
        </section>
      </ng-container>

      <ng-template #emptyState>
        <article class="panel empty">
          <h3>No hay datos cargados</h3>
          <p>Importá el Excel para ver el histórico.</p>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; }
    .page-header .eyebrow, .panel .eyebrow { margin: 0; color: var(--brand); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; }
    .page-header h2, .panel h3 { margin: 0.2rem 0 0; }
    .lead { color: var(--muted); margin: 0.35rem 0 0; }
    .panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1rem; display: grid; gap: 0.9rem; }
    .toolbar, .title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .period, .date-range label { display: grid; gap: 0.3rem; color: var(--muted); font-size: 0.84rem; }
    .period select, .date-range input { background: rgba(255,255,255,0.04); color: var(--text); border: 1px solid var(--panel-border); border-radius: 12px; padding: 0.6rem 0.8rem; }
    .date-range { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
    .stats-row { display: flex; flex-wrap: wrap; gap: 0.75rem; color: var(--muted); font-size: 0.85rem; }
    .empty { justify-items: start; }
    @media (max-width: 900px) {
      .toolbar, .title-row { align-items: start; }
    }
  `]
})
export class HistoricalPageComponent {
  selectedHistoricalSymbol = '';
  pricePeriod: DatePeriod = 'ALL';
  priceRangeStart = '';
  priceRangeEnd = '';
  balancePeriod: DatePeriod = 'ALL';
  balanceRangeStart = '';
  balanceRangeEnd = '';

  constructor(
    public readonly state: PortfolioStateService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly chartData: ChartDataService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  historicalSpeciesOptions(snapshot: PortfolioAppState): HistoricalSymbolOption[] {
    const positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    const symbols = Array.from(new Set(snapshot.dataset?.historicalPrices.map((item) => item.symbol).filter(Boolean) ?? [])).sort((a, b) => a.localeCompare(b, 'es'));
    return symbols.map((symbol) => {
      const position = positions.find((item) => item.symbol === symbol);
      const asset = position?.assetType || position?.classification?.type || null;
      const sector = position?.classification?.sector || position?.sector || null;
      const subsector = position?.classification?.subsector || position?.subsector || null;
      const region = position?.classification?.region || position?.region || null;
      const labelParts = [asset, subsector || sector, region].filter(Boolean);
      return {
        symbol,
        label: labelParts.length ? `${symbol} - ${labelParts.join(' / ')}` : symbol,
        searchText: [symbol, asset, sector, subsector, region].filter(Boolean).join(' ').toLowerCase()
      };
    });
  }

  selectedHistoricalLabel(snapshot: PortfolioAppState): string {
    return this.historicalSpeciesOptions(snapshot).find((item) => item.symbol === this.selectedHistoricalSymbol)?.label || this.selectedHistoricalSymbol || 'Sin especie seleccionada';
  }

  selectedHistoricalCurrency(snapshot: PortfolioAppState): string {
    const positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    return positions.find((item) => item.symbol === this.selectedHistoricalSymbol)?.currency || 'UNKNOWN';
  }

  historicalPriceSeries(snapshot: PortfolioAppState) {
    const raw = (snapshot.dataset?.historicalPrices ?? []).filter((item) => item.symbol === this.selectedHistoricalSymbol && item.price !== null);
    return this.chartData.priceSeries(this.filterHistoricalByPeriod(raw, this.pricePeriod, this.priceRangeStart, this.priceRangeEnd), this.selectedHistoricalSymbol);
  }

  balanceSeries(snapshot: PortfolioAppState) {
    const raw = (snapshot.dataset?.dailyBalances ?? []).filter((item) => item.balance !== null);
    return this.chartData.balanceSeries(this.filterHistoricalByPeriod(raw, this.balancePeriod, this.balanceRangeStart, this.balanceRangeEnd));
  }

  historicalPriceStats(snapshot: PortfolioAppState) {
    const series = this.historicalPriceSeries(snapshot);
    if (!series.length) return null;
    const values = series.map((item) => item.value);
    const initial = values[0];
    const final = values[values.length - 1];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const latest = values.at(-1) ?? final;
    const previous = values.length > 1 ? values[values.length - 2] : null;
    return {
      initial,
      final,
      variationAmount: final - initial,
      variationPercent: initial > 0 ? ((final - initial) / initial) * 100 : null,
      latest,
      latestDate: series.at(-1)?.label ?? null,
      latestChangeAmount: previous !== null ? latest - previous : null,
      latestChangePercent: previous && previous !== 0 ? ((latest - previous) / previous) * 100 : null,
      max,
      maxDate: series.find((item) => item.value === max)?.label ?? null,
      min,
      minDate: series.find((item) => item.value === min)?.label ?? null,
      startDate: series[0]?.label ?? null,
      endDate: series[series.length - 1]?.label ?? null
    };
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  percent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  private filterHistoricalByPeriod<T extends { date: string | Date | null }>(values: T[], period: DatePeriod, startDate: string, endDate: string): T[] {
    if (!values.length) {
      return [];
    }
    const ordered = [...values].sort((a, b) => this.sortDateValue(a.date) - this.sortDateValue(b.date));
    const latest = ordered.at(-1)?.date ?? null;
    const latestDate = latest ? parseExcelDate(latest) : null;
    const start = startDate ? parseExcelDate(startDate) : null;
    const end = endDate ? parseExcelDate(endDate) : null;
    return ordered.filter((item) => {
      const date = parseExcelDate(item.date);
      if (!date) return false;
      if (period === 'CUSTOM') {
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      }
      if (period === 'ALL' || !latestDate) return true;
      const threshold = this.periodStart(latestDate, period);
      return threshold ? date >= threshold : true;
    });
  }

  private periodStart(reference: Date, period: DatePeriod): Date | null {
    const date = new Date(reference);
    switch (period) {
      case '1M': date.setMonth(date.getMonth() - 1); return date;
      case '3M': date.setMonth(date.getMonth() - 3); return date;
      case '6M': date.setMonth(date.getMonth() - 6); return date;
      case 'YTD': return new Date(date.getFullYear(), 0, 1);
      case '1Y': date.setFullYear(date.getFullYear() - 1); return date;
      default: return null;
    }
  }

  private sortDateValue(value: string | Date | null): number {
    const date = parseExcelDate(value);
    return date ? date.getTime() : 0;
  }
}
