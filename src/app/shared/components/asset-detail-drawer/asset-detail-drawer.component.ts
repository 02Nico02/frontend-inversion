import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { AssetClassification, HistoricalPrice, InvestmentOperation, PortfolioPosition } from '../../../core/models/portfolio.models';
import { parseExcelDate } from '../../../core/utils/value-parsing.utils';
import { SimpleChartComponent } from '../simple-chart/simple-chart.component';

type DetailTab = 'summary' | 'operations' | 'alerts' | 'history' | 'classification';
type SortDirection = 'asc' | 'desc';
type PageSize = 10 | 25 | 50 | 'all';
type Period = 'ALL' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'CUSTOM';

@Component({
  selector: 'app-asset-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './asset-detail-drawer.component.html',
  styleUrls: ['./asset-detail-drawer.component.scss'],
})
export class AssetDetailDrawerComponent {
  @Input() open = false;
  @Input() symbol: string | null = null;
  @Input() positions: PortfolioPosition[] = [];
  @Input() operations: InvestmentOperation[] = [];
  @Input() alerts: CombinedAlert[] = [];
  @Input() historicalPrices: HistoricalPrice[] = [];
  @Input() classifications: AssetClassification[] = [];
  @Output() close = new EventEmitter<void>();

  tab: DetailTab = 'summary';
  operationSortDirection: SortDirection = 'desc';
  operationPageSize: PageSize = 25;
  operationPageIndex = 0;
  historyPeriod: Period = 'ALL';

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.close.emit();
    }
  }

  get position(): PortfolioPosition | null {
    const symbol = this.symbol?.toUpperCase();
    if (!symbol) {
      return null;
    }
    return this.positions.find((item) => item.symbol.toUpperCase() === symbol) ?? null;
  }

  classification(position: PortfolioPosition): AssetClassification | null {
    const symbol = position.symbol.toUpperCase();
    return this.classifications.find((item) => item.symbol.toUpperCase() === symbol) ?? position.classification ?? null;
  }

  missingClassification(position: PortfolioPosition): string {
    const classification = this.classification(position);
    const missing = [
      !classification?.type ? 'tipo activo' : null,
      !classification?.sector ? 'sector' : null,
      !classification?.subsector ? 'subsector' : null,
      !classification?.region ? 'región' : null
    ].filter(Boolean);
    return missing.length ? missing.join(', ') : 'Sin faltantes';
  }

  headerSummary(position: PortfolioPosition): string {
    const classification = this.classification(position);
    const parts = [
      classification?.type || position.positionType || 'Sin tipo',
      classification?.sector || position.sector || 'Sin sector',
      classification?.subsector || position.subsector || 'Sin subsector',
      classification?.region || position.region || 'Sin región'
    ];
    return parts.join(' · ');
  }

  expectedMetrics(position: PortfolioPosition): { hasTarget: boolean; expected: number; delta: number; deviation: number } {
    const expected = this.classification(position)?.expected ?? null;
    if (expected === null || expected === undefined || expected === 0) {
      return { hasTarget: false, expected: 0, delta: 0, deviation: 0 };
    }
    const delta = position.currentValue - expected;
    const deviation = (delta / expected) * 100;
    return { hasTarget: true, expected, delta, deviation };
  }

  operationsFor(symbol: string): InvestmentOperation[] {
    const key = symbol.toUpperCase();
    return [...this.operations]
      .filter((operation) => operation.symbol.toUpperCase() === key)
      .sort((a, b) => {
        const direction = this.operationSortDirection === 'asc' ? 1 : -1;
        return this.dateValue(a.date) > this.dateValue(b.date) ? direction : this.dateValue(a.date) < this.dateValue(b.date) ? -direction : 0;
      });
  }

  pagedOperations(symbol: string): InvestmentOperation[] {
    const operations = this.operationsFor(symbol);
    if (this.operationPageSize === 'all') {
      return operations;
    }
    const start = this.currentOperationPageIndex * this.operationPageSize;
    return operations.slice(start, start + this.operationPageSize);
  }

  operationPageCount(symbol: string): number {
    const operations = this.operationsFor(symbol);
    if (this.operationPageSize === 'all') {
      return 1;
    }
    return Math.max(1, Math.ceil(operations.length / this.operationPageSize));
  }

  get currentOperationPageIndex(): number {
    const max = Math.max(0, this.operationPageCount(this.symbol ?? '') - 1);
    return Math.min(this.operationPageIndex, max);
  }

  firstOperationPage(): void {
    this.operationPageIndex = 0;
  }

  previousOperationPage(): void {
    this.operationPageIndex = Math.max(0, this.currentOperationPageIndex - 1);
  }

  nextOperationPage(symbol: string): void {
    this.operationPageIndex = Math.min(this.operationPageCount(symbol) - 1, this.currentOperationPageIndex + 1);
  }

  lastOperationPage(symbol: string): void {
    this.operationPageIndex = this.operationPageCount(symbol) - 1;
  }

  totalQuantity(symbol: string): number {
    return this.operationsFor(symbol).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  }

  totalInvested(symbol: string): number {
    return this.operationsFor(symbol).reduce((sum, item) => sum + (item.total ?? item.amount ?? 0), 0);
  }

  totalCurrent(symbol: string): number {
    return this.operationsFor(symbol).reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
  }

  weightedAveragePrice(symbol: string): number {
    const operations = this.operationsFor(symbol);
    const totalQuantity = operations.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const totalInvested = this.totalInvested(symbol);
    return totalQuantity > 0 ? totalInvested / totalQuantity : 0;
  }

  weightedReturn(symbol: string): string {
    const invested = this.totalInvested(symbol);
    const current = this.totalCurrent(symbol);
    return this.formatPercent(invested > 0 ? ((current - invested) / invested) * 100 : null);
  }

  operationResult(operation: InvestmentOperation): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const current = operation.currentValue ?? null;
    if (invested === null || current === null) {
      return null;
    }
    return current - invested;
  }

  operationResultPercent(operation: InvestmentOperation): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const result = this.operationResult(operation);
    if (invested === null || invested === 0 || result === null) {
      return null;
    }
    return (result / invested) * 100;
  }

  lotWeight(operation: InvestmentOperation): number {
    const symbol = operation.symbol.toUpperCase();
    const position = this.positionBySymbol(symbol);
    const totalCurrent = position?.currentValue ?? this.totalCurrent(symbol);
    const currentValue = operation.currentValue ?? 0;
    return totalCurrent > 0 ? (currentValue / totalCurrent) * 100 : 0;
  }

  manualAlerts(symbol: string): CombinedAlert[] {
    return this.alerts.filter((alert) => alert.group === 'manual' && alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  sortedManualAlerts(symbol: string): CombinedAlert[] {
    const rank = (status: string): number => {
      switch (status) {
        case 'activada':
          return 0;
        case 'cerca':
          return 1;
        case 'lejos':
          return 2;
        default:
          return 3;
      }
    };
    return [...this.manualAlerts(symbol)].sort((a, b) => rank(a.status) - rank(b.status) || Math.abs(a.distancePercent ?? Infinity) - Math.abs(b.distancePercent ?? Infinity));
  }

  calculatedAlerts(symbol: string): CombinedAlert[] {
    return this.alerts.filter((alert) => alert.group === 'calculated' && alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  signalAlerts(symbol: string): CombinedAlert[] {
    return this.alerts.filter((alert) => alert.group === 'signal' && alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  sortedSignalAlerts(symbol: string): CombinedAlert[] {
    return [...this.signalAlerts(symbol)].sort((a, b) => Math.abs(a.distancePercent ?? Infinity) - Math.abs(b.distancePercent ?? Infinity));
  }

  historicalSeries(symbol: string): Array<{ label: string; value: number; date?: string | null; changeAmount?: number | null; changePercent?: number | null }> {
    const ordered = this.filteredHistory(symbol);
    return ordered.map((item, index) => {
      const value = Number(item.price ?? 0);
      const previous = index > 0 ? Number(ordered[index - 1].price ?? 0) : null;
      return {
        label: this.formatDate(item.date),
        value,
        date: this.formatDate(item.date),
        changeAmount: previous !== null ? value - previous : null,
        changePercent: previous && previous !== 0 ? ((value - previous) / previous) * 100 : null
      };
    });
  }

  historyStats(symbol: string): { initial: number; final: number; variationAmount: number; variationPercent: number | null; startDate: string | null; endDate: string | null; max: number; maxDate: string | null; min: number; minDate: string | null; count: number } | null {
    const series = this.filteredHistory(symbol);
    if (!series.length) {
      return null;
    }
    const first = series[0];
    const last = series[series.length - 1];
    const values = series.map((item) => Number(item.price ?? 0));
    const initial = Number(first.price ?? 0);
    const final = Number(last.price ?? 0);
    const variationAmount = final - initial;
    return {
      initial,
      final,
      variationAmount,
      variationPercent: initial > 0 ? (variationAmount / initial) * 100 : null,
      startDate: this.formatDate(first.date),
      endDate: this.formatDate(last.date),
      max: Math.max(...values),
      maxDate: this.formatDate(series.find((item) => Number(item.price ?? 0) === Math.max(...values))?.date),
      min: Math.min(...values),
      minDate: this.formatDate(series.find((item) => Number(item.price ?? 0) === Math.min(...values))?.date),
      count: series.length
    };
  }

  private filteredHistory(symbol: string): HistoricalPrice[] {
    const ordered = this.historicalFor(symbol);
    switch (this.historyPeriod) {
      case '1M':
        return this.filterByPeriod(ordered, 1);
      case '3M':
        return this.filterByPeriod(ordered, 3);
      case '6M':
        return this.filterByPeriod(ordered, 6);
      case 'YTD':
        return this.filterByYtd(ordered);
      case '1Y':
        return this.filterByPeriod(ordered, 12);
      case 'CUSTOM':
      case 'ALL':
      default:
        return ordered;
    }
  }

  currencyTotal(currency: string): string {
    const normalized = this.currencyMapper.normalizeCurrency(currency);
    const total = this.positions
      .filter((position) => this.currencyMapper.normalizeCurrency(position.currency) === normalized)
      .reduce((sum, position) => sum + position.currentValue, 0);
    return this.formatMoney(total, currency);
  }

  weightFor(symbol: string): number {
    const position = this.positionBySymbol(symbol);
    if (!position) {
      return 0;
    }
    const totalByCurrency = this.positions
      .filter((item) => this.currencyMapper.normalizeCurrency(item.currency) === this.currencyMapper.normalizeCurrency(position.currency))
      .reduce((sum, item) => sum + item.currentValue, 0);
    return totalByCurrency > 0 ? (position.currentValue / totalByCurrency) * 100 : 0;
  }

  expectedDeviation(position: PortfolioPosition): string {
    const expected = this.classification(position)?.expected;
    if (!expected) {
      return 'Sin datos';
    }
    const deviation = ((position.currentValue - expected) / expected) * 100;
    return this.formatPercent(deviation);
  }

  classificationHelp(position: PortfolioPosition): string {
    const missing = this.missingClassification(position);
    if (missing === 'Sin faltantes') {
      return 'Clasificación completa.';
    }
    const notes: string[] = [];
    if (missing.includes('sector')) {
      notes.push('Falta sector en Tabla47. Eso agrupa la especie como "Sin sector" en los gráficos.');
    }
    if (missing.includes('subsector')) {
      notes.push('Falta subsector en Tabla47. Eso reduce el detalle de las categorías.');
    }
    if (missing.includes('región')) {
      notes.push('Falta región en Tabla47. Eso afecta los cortes geográficos.');
    }
    if (missing.includes('tipo activo')) {
      notes.push('Falta tipo activo. Eso afecta filtros y resumen por clase.');
    }
    return notes.join(' ');
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) {
      return 'Sin datos';
    }
    const date = parseExcelDate(value);
    if (!date) {
      return 'Sin datos';
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  formatNumber(value: number | null | undefined): string {
    return this.currencyMapper.formatNumber(value);
  }

  formatMoney(value: number | null | undefined, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
  }

  formatPercent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  currencyLabel(currency: string): string {
    return this.currencyMapper.getCurrencyLabel(currency);
  }

  trackByOperationId(index: number, operation: InvestmentOperation): string {
    return operation.id || `${index}`;
  }

  private historicalFor(symbol: string): HistoricalPrice[] {
    const key = symbol.toUpperCase();
    return [...this.historicalPrices]
      .filter((item) => item.symbol.toUpperCase() === key && item.price !== null)
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
  }

  private filterByPeriod(series: HistoricalPrice[], monthsBack: number): HistoricalPrice[] {
    const lastDate = this.lastDate(series);
    if (!lastDate) {
      return series;
    }
    const start = new Date(lastDate);
    start.setMonth(start.getMonth() - monthsBack);
    return series.filter((item) => {
      const value = this.dateValue(item.date);
      return value >= start.getTime() && value <= lastDate.getTime();
    });
  }

  private filterByYtd(series: HistoricalPrice[]): HistoricalPrice[] {
    const lastDate = this.lastDate(series);
    if (!lastDate) {
      return series;
    }
    const start = new Date(lastDate.getFullYear(), 0, 1);
    return series.filter((item) => {
      const value = this.dateValue(item.date);
      return value >= start.getTime() && value <= lastDate.getTime();
    });
  }

  private lastDate(series: HistoricalPrice[]): Date | null {
    if (!series.length) {
      return null;
    }
    const last = series[series.length - 1]?.date;
    const parsed = parseExcelDate(last);
    return parsed;
  }

  private positionBySymbol(symbol: string): PortfolioPosition | null {
    const key = symbol.toUpperCase();
    return this.positions.find((position) => position.symbol.toUpperCase() === key) ?? null;
  }

  private dateValue(value: string | Date | null | undefined): number {
    if (!value) {
      return 0;
    }
    const date = parseExcelDate(value);
    return date ? date.getTime() : 0;
  }
}
