import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { PortfolioPosition } from '../../../core/models/portfolio.models';
import { FilterChipComponent } from '../filter-chip/filter-chip.component';
import { SearchableSelectComponent, SearchableSelectOption } from '../searchable-select/searchable-select.component';
import { PositionsFilterStateService } from '../../../features/positions/services/positions-filter-state.service';

type SortField = 'symbol' | 'resultAmount' | 'resultPercent' | 'currentValue' | 'portfolioWeight';
type SortDirection = 'asc' | 'desc';
type PageSize = 10 | 25 | 50 | 'all';
type FilterKey = 'symbol' | 'currency' | 'assetType' | 'sector' | 'subsector' | 'region' | 'resultDirection' | 'alerts' | 'classification';

@Component({
  selector: 'app-positions-table',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, FilterChipComponent],
  templateUrl: './positions-table.component.html',
  styleUrls: ['./positions-table.component.scss'],
})
export class PositionsTableComponent implements OnInit {
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
    resultDirection: 'all' as 'all' | 'positive' | 'negative',
    alerts: 'all' as 'all' | 'with' | 'without',
    classification: 'all' as 'all' | 'with' | 'without'
  };

  sortField: SortField = 'currentValue';
  sortDirection: SortDirection = 'desc';
  pageSize: PageSize = 10;
  pageIndex = 0;
  showAdvancedFilters = false;

  constructor(
    private readonly currencyMapper: CurrencyMapperService,
    private readonly filterState: PositionsFilterStateService
  ) {
    const snapshot = this.filterState.snapshot;
    this.filters = {
      symbol: snapshot.symbol,
      currency: snapshot.currency,
      assetType: snapshot.assetType,
      sector: snapshot.sector,
      subsector: snapshot.subsector,
      region: snapshot.region,
      resultDirection: snapshot.resultDirection,
      alerts: snapshot.alerts,
      classification: snapshot.classification
    };
    this.sortField = snapshot.sortField;
    this.sortDirection = snapshot.sortDirection;
    this.pageSize = snapshot.pageSize;
    this.pageIndex = snapshot.pageIndex;
    this.showAdvancedFilters = snapshot.advancedOpen;
  }

  ngOnInit(): void {
    this.persistState();
  }

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

  get symbolOptions(): SearchableSelectOption[] {
    return this.uniqueOptions(
      this.positions.map((position) => ({
        value: position.symbol,
        label: position.symbol,
        searchText: [position.symbol, position.assetType, position.sector, position.subsector, position.region].filter(Boolean).join(' ')
      }))
    );
  }

  get assetTypeOptions(): SearchableSelectOption[] {
    return this.uniqueOptions(
      this.positions.map((position) => ({
        value: position.assetType ?? '',
        label: position.assetType ?? 'Sin clasificar',
        searchText: [position.assetType, position.symbol, position.sector, position.subsector, position.region].filter(Boolean).join(' ')
      }))
    );
  }

  get sectorOptions(): SearchableSelectOption[] {
    return this.uniqueOptions(
      this.positions.map((position) => ({
        value: position.classification?.sector || position.sector || '',
        label: position.classification?.sector || position.sector || 'Sin sector',
        searchText: [position.symbol, position.assetType, position.classification?.sector || position.sector, position.classification?.subsector || position.subsector, position.classification?.region || position.region].filter(Boolean).join(' ')
      }))
    );
  }

  get subsectorOptions(): SearchableSelectOption[] {
    return this.uniqueOptions(
      this.positions.map((position) => ({
        value: position.classification?.subsector || position.subsector || '',
        label: position.classification?.subsector || position.subsector || 'Sin subsector',
        searchText: [position.symbol, position.assetType, position.classification?.sector || position.sector, position.classification?.subsector || position.subsector, position.classification?.region || position.region].filter(Boolean).join(' ')
      }))
    );
  }

  get regionOptions(): SearchableSelectOption[] {
    return this.uniqueOptions(
      this.positions.map((position) => ({
        value: position.classification?.region || position.region || '',
        label: position.classification?.region || position.region || 'Sin región',
        searchText: [position.symbol, position.assetType, position.classification?.sector || position.sector, position.classification?.subsector || position.subsector, position.classification?.region || position.region].filter(Boolean).join(' ')
      }))
    );
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
    this.showAdvancedFilters = false;
    this.persistState();
  }

  firstPage(): void {
    this.pageIndex = 0;
    this.persistState();
  }

  previousPage(): void {
    this.pageIndex = Math.max(0, this.currentPageIndex - 1);
    this.persistState();
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.pageCount - 1, this.currentPageIndex + 1);
    this.persistState();
  }

  lastPage(): void {
    this.pageIndex = this.pageCount - 1;
    this.persistState();
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

  onFilterChange(): void {
    this.pageIndex = 0;
    this.persistState();
  }

  onSortChange(): void {
    this.pageIndex = 0;
    this.persistState();
  }

  onPageChange(): void {
    this.persistState();
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
    this.persistState();
  }

  chips(): Array<{ label: string; value: string; reset: FilterKey | 'sortField' | 'sortDirection' | 'pageSize' }> {
    const items: Array<{ label: string; value: string; reset: FilterKey | 'sortField' | 'sortDirection' | 'pageSize' }> = [];
    if (this.filters.symbol) items.push({ label: 'Especie', value: this.filters.symbol, reset: 'symbol' });
    if (this.filters.currency) items.push({ label: 'Moneda', value: this.currencyLabel(this.filters.currency), reset: 'currency' });
    if (this.filters.assetType) items.push({ label: 'Tipo activo', value: this.filters.assetType, reset: 'assetType' });
    if (this.filters.sector) items.push({ label: 'Sector', value: this.filters.sector, reset: 'sector' });
    if (this.filters.subsector) items.push({ label: 'Subsector', value: this.filters.subsector, reset: 'subsector' });
    if (this.filters.region) items.push({ label: 'Región', value: this.filters.region, reset: 'region' });
    if (this.filters.resultDirection !== 'all') items.push({ label: 'Resultado', value: this.filters.resultDirection === 'positive' ? 'Positivos' : 'Negativos', reset: 'resultDirection' });
    if (this.filters.alerts !== 'all') items.push({ label: 'Alertas', value: this.filters.alerts === 'with' ? 'Con alertas' : 'Sin alertas', reset: 'alerts' });
    if (this.filters.classification !== 'all') items.push({ label: 'Clasificación', value: this.filters.classification === 'with' ? 'Con clasificación' : 'Sin clasificación', reset: 'classification' });
    if (this.sortField !== 'currentValue') items.push({ label: 'Orden', value: this.sortLabel(), reset: 'sortField' });
    if (this.sortDirection !== 'desc') items.push({ label: 'Dirección', value: this.sortDirection === 'asc' ? 'Ascendente' : 'Descendente', reset: 'sortDirection' });
    if (this.pageSize !== 10) items.push({ label: 'Filas', value: this.pageSize === 'all' ? 'Todas' : `${this.pageSize}`, reset: 'pageSize' });
    return items;
  }

  resetFilter(key: FilterKey | 'sortField' | 'sortDirection' | 'pageSize'): void {
    if (key === 'sortField') {
      this.sortField = 'currentValue';
    } else if (key === 'sortDirection') {
      this.sortDirection = 'desc';
    } else if (key === 'pageSize') {
      this.pageSize = 10;
    } else if (key === 'resultDirection') {
      this.filters.resultDirection = 'all';
    } else if (key === 'alerts') {
      this.filters.alerts = 'all';
    } else if (key === 'classification') {
      this.filters.classification = 'all';
    } else {
      this.filters[key] = '';
    }
    this.pageIndex = 0;
    this.persistState();
  }

  private uniqueOptions(values: SearchableSelectOption[]): SearchableSelectOption[] {
    const bucket = new Map<string, SearchableSelectOption>();
    for (const option of values) {
      const key = option.value.trim();
      if (!key) continue;
      bucket.set(key.toLowerCase(), { ...option, value: key, label: option.label.trim() || key });
    }
    return Array.from(bucket.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  private persistState(): void {
    this.filterState.update({
      ...this.filters,
      sortField: this.sortField,
      sortDirection: this.sortDirection,
      pageSize: this.pageSize,
      pageIndex: this.pageIndex,
      advancedOpen: this.showAdvancedFilters
    });
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

  private sortLabel(): string {
    switch (this.sortField) {
      case 'symbol':
        return 'Especie';
      case 'resultAmount':
        return 'Resultado';
      case 'resultPercent':
        return 'Resultado %';
      case 'portfolioWeight':
        return 'Peso';
      case 'currentValue':
      default:
        return 'Total actual';
    }
  }
}
