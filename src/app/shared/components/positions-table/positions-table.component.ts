import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { PortfolioPosition } from '../../../core/models/portfolio.models';

type SortField = 'symbol' | 'resultAmount' | 'resultPercent' | 'currentValue' | 'portfolioWeight';
type SortDirection = 'asc' | 'desc';
type PageSize = 10 | 25 | 50 | 'all';

@Component({
  selector: 'app-positions-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './positions-table.component.html',
  styleUrls: ['./positions-table.component.scss'],
})
export class PositionsTableComponent {
  @Input() positions: PortfolioPosition[] = [];
  @Input() alerts: CombinedAlert[] = [];
  @Output() detailRequested = new EventEmitter<string>();

  filters = {
    symbol: '',
    currency: '',
    assetType: '',
    sector: '',
    subsector: '',
    region: '',
    resultDirection: 'all',
    alerts: 'all',
    classification: 'all'
  };

  sortField: SortField = 'currentValue';
  sortDirection: SortDirection = 'desc';
  pageSize: PageSize = 10;
  pageIndex = 0;

  readonly symbolListId = 'position-symbol-list';
  readonly assetTypeListId = 'position-asset-type-list';
  readonly sectorListId = 'position-sector-list';
  readonly subsectorListId = 'position-subsector-list';
  readonly regionListId = 'position-region-list';

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  get filteredPositions(): PortfolioPosition[] {
    return this.positions
      .filter((position) => {
        const symbol = position.symbol.toLowerCase();
        const sector = (position.classification?.sector || position.sector || '').toLowerCase();
        const subsector = (position.classification?.subsector || position.subsector || '').toLowerCase();
        const region = (position.classification?.region || position.region || '').toLowerCase();
        const assetType = (position.assetType || '').toLowerCase();
        const currency = this.currencyMapper.normalizeCurrency(position.currency);
        const hasClassification = Boolean(position.classification);
        const hasAlerts = this.hasAlert(position.symbol);
        const resultPositive = (position.resultAmount ?? 0) >= 0;

        return (
          (!this.filters.symbol || symbol.includes(this.filters.symbol.toLowerCase())) &&
          (!this.filters.currency || currency === this.filters.currency) &&
          (!this.filters.assetType || assetType.includes(this.filters.assetType.toLowerCase())) &&
          (!this.filters.sector || sector.includes(this.filters.sector.toLowerCase())) &&
          (!this.filters.subsector || subsector.includes(this.filters.subsector.toLowerCase())) &&
          (!this.filters.region || region.includes(this.filters.region.toLowerCase())) &&
          (this.filters.resultDirection === 'all' ||
            (this.filters.resultDirection === 'positive' && resultPositive) ||
            (this.filters.resultDirection === 'negative' && !resultPositive)) &&
          (this.filters.alerts === 'all' ||
            (this.filters.alerts === 'with' && hasAlerts) ||
            (this.filters.alerts === 'without' && !hasAlerts)) &&
          (this.filters.classification === 'all' ||
            (this.filters.classification === 'with' && hasClassification) ||
            (this.filters.classification === 'without' && !hasClassification))
        );
      })
      .sort((a, b) => {
        const direction = this.sortDirection === 'asc' ? 1 : -1;
        const aValue = this.sortValue(a);
        const bValue = this.sortValue(b);
        return aValue > bValue ? direction : aValue < bValue ? -direction : 0;
      });
  }

  get pageCount(): number {
    if (this.pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(this.filteredPositions.length / this.pageSize));
  }

  get currentPageIndex(): number {
    return Math.min(this.pageIndex, this.pageCount - 1);
  }

  get pagedPositions(): PortfolioPosition[] {
    if (this.pageSize === 'all') {
      return this.filteredPositions;
    }
    const start = this.currentPageIndex * this.pageSize;
    return this.filteredPositions.slice(start, start + this.pageSize);
  }

  get symbolOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.symbol));
  }

  get assetTypeOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.assetType ?? ''));
  }

  get sectorOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.classification?.sector || position.sector || ''));
  }

  get subsectorOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.classification?.subsector || position.subsector || ''));
  }

  get regionOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.classification?.region || position.region || ''));
  }

  requestDetail(symbol: string): void {
    this.detailRequested.emit(symbol);
  }

  weightFor(position: PortfolioPosition): number {
    const currency = this.currencyMapper.normalizeCurrency(position.currency);
    const totalByCurrency = this.positions
      .filter((item) => this.currencyMapper.normalizeCurrency(item.currency) === currency)
      .reduce((sum, item) => sum + item.currentValue, 0);
    return totalByCurrency > 0 ? (position.currentValue / totalByCurrency) * 100 : 0;
  }

  hasAlert(symbol: string): boolean {
    return this.alerts.some((alert) => alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  alertCount(symbol: string): string {
    const count = this.alerts.filter((alert) => alert.symbol.toUpperCase() === symbol.toUpperCase()).length;
    return count ? `${count}` : '0';
  }

  clearFilters(): void {
    this.filters = {
      symbol: '',
      currency: '',
      assetType: '',
      sector: '',
      subsector: '',
      region: '',
      resultDirection: 'all',
      alerts: 'all',
      classification: 'all'
    };
    this.sortField = 'currentValue';
    this.sortDirection = 'desc';
    this.pageSize = 10;
    this.pageIndex = 0;
  }

  firstPage(): void {
    this.pageIndex = 0;
  }

  previousPage(): void {
    this.pageIndex = Math.max(0, this.currentPageIndex - 1);
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.pageCount - 1, this.currentPageIndex + 1);
  }

  lastPage(): void {
    this.pageIndex = this.pageCount - 1;
  }

  currencyLabel(currency: string): string {
    return this.currencyMapper.getCurrencyLabel(currency);
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

  trackBySymbol(index: number, position: PortfolioPosition): string {
    return position.symbol || `${index}`;
  }

  private sortValue(position: PortfolioPosition): string | number {
    switch (this.sortField) {
      case 'symbol':
        return position.symbol;
      case 'resultAmount':
        return position.resultAmount;
      case 'resultPercent':
        return position.resultPercent ?? -Infinity;
      case 'portfolioWeight':
        return position.portfolioWeight ?? -Infinity;
      case 'currentValue':
      default:
        return position.currentValue;
    }
  }

  private uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
  }
}
