import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { AssetDetailService, AssetDetailViewModel, AssetHistoryStats } from '../../../asset-detail/services/asset-detail.service';
import { MinimumPerformanceBySymbol, MinimumPerformanceLot } from '../../../../core/models/minimum-performance.model';
import { MinimumPerformanceService } from '../../../../core/services/minimum-performance.service';

type DetailTab = 'summary' | 'operations' | 'alerts' | 'history' | 'classification';
type SortDirection = 'asc' | 'desc';
type PageSize = 10 | 25 | 50 | 'all';
type Period = 'ALL' | '1M' | '3M' | '6M' | 'YTD' | '1Y';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './position-detail-page.component.html',
  styleUrls: ['./position-detail-page.component.scss']
})
export class PositionDetailPageComponent implements OnInit, OnDestroy {
  tab: DetailTab = 'summary';
  operationSortDirection: SortDirection = 'desc';
  operationPageSize: PageSize = 25;
  operationPageIndex = 0;
  historyPeriod: Period = 'ALL';
  showAdvancedColumns = false;

  detail: AssetDetailViewModel | null = null;
  historyChartSeries: ReturnType<AssetDetailService['seriesForHistory']> = [];
  historyStats: AssetHistoryStats | null = null;
  minimumPerformance: MinimumPerformanceBySymbol | null = null;
  minimumPerformanceLots: MinimumPerformanceLot[] = [];

  private symbol = '';
  private subscription?: Subscription;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly assetDetail: AssetDetailService,
    private readonly minimumPerformanceService: MinimumPerformanceService
  ) {}

  ngOnInit(): void {
    this.subscription = combineLatest([this.route.paramMap, this.state.state$]).subscribe(([params, snapshot]) => {
      this.symbol = params.get('symbol')?.toUpperCase() ?? '';
      this.detail = this.symbol ? this.assetDetail.buildViewModel(snapshot, this.symbol) : null;
      this.operationPageIndex = 0;
      this.refreshMinimumPerformance(snapshot);
      this.refreshHistory();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  back(): void {
    this.router.navigateByUrl('/posiciones');
  }

  setHistoryPeriod(period: Period): void {
    this.historyPeriod = period;
    this.refreshHistory();
  }

  sortedOperations(detail: AssetDetailViewModel) {
    const direction = this.operationSortDirection === 'asc' ? 1 : -1;
    return [...detail.operations].sort((a, b) => {
      const left = this.dateValue(a.date);
      const right = this.dateValue(b.date);
      return left > right ? direction : left < right ? -direction : 0;
    });
  }

  pagedOperations(detail: AssetDetailViewModel) {
    const operations = this.sortedOperations(detail);
    if (this.operationPageSize === 'all') {
      return operations;
    }
    const start = this.currentOperationPageIndex * this.operationPageSize;
    return operations.slice(start, start + this.operationPageSize);
  }

  operationPageCount(detail: AssetDetailViewModel): number {
    const operations = this.sortedOperations(detail);
    if (this.operationPageSize === 'all') {
      return 1;
    }
    return Math.max(1, Math.ceil(operations.length / this.operationPageSize));
  }

  get currentOperationPageIndex(): number {
    if (!this.detail || this.operationPageSize === 'all') {
      return 0;
    }
    const max = Math.max(0, this.operationPageCount(this.detail) - 1);
    return Math.min(this.operationPageIndex, max);
  }

  currentOperationPageNumber(detail: AssetDetailViewModel): number {
    return Math.min(this.operationPageIndex, this.operationPageCount(detail) - 1) + 1;
  }

  firstOperationPage(): void {
    this.operationPageIndex = 0;
  }

  previousOperationPage(): void {
    if (!this.detail || this.operationPageSize === 'all') return;
    this.operationPageIndex = Math.max(0, this.currentOperationPageIndex - 1);
  }

  nextOperationPage(detail: AssetDetailViewModel): void {
    if (this.operationPageSize === 'all') return;
    this.operationPageIndex = Math.min(this.operationPageCount(detail) - 1, this.currentOperationPageIndex + 1);
  }

  lastOperationPage(detail: AssetDetailViewModel): void {
    this.operationPageIndex = this.operationPageCount(detail) - 1;
  }

  totalQuantity(detail: AssetDetailViewModel): number {
    return detail.operationMetrics.totalQuantity;
  }

  totalInvested(detail: AssetDetailViewModel): number {
    return detail.operationMetrics.totalInvested;
  }

  totalCurrent(detail: AssetDetailViewModel): number {
    return detail.operationMetrics.totalCurrent;
  }

  weightedAveragePrice(detail: AssetDetailViewModel): number {
    return detail.operationMetrics.weightedAveragePrice;
  }

  weightedReturn(detail: AssetDetailViewModel): string {
    return this.assetDetail.formatPercent(detail.operationMetrics.resultPercent);
  }

  operationResult(operation: AssetDetailViewModel['operations'][number]): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const current = operation.currentValue ?? null;
    if (invested === null || current === null) {
      return null;
    }
    return current - invested;
  }

  operationResultPercent(operation: AssetDetailViewModel['operations'][number]): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const result = this.operationResult(operation);
    if (invested === null || invested === 0 || result === null) {
      return null;
    }
    return (result / invested) * 100;
  }

  lotWeight(operation: AssetDetailViewModel['operations'][number], detail: AssetDetailViewModel): number {
    const currentValue = operation.currentValue ?? 0;
    const totalCurrent = detail.position.currentValue;
    return totalCurrent > 0 ? (currentValue / totalCurrent) * 100 : 0;
  }

  historicalSeries(detail: AssetDetailViewModel) {
    const filtered = this.assetDetail.filterHistory(detail.historicalPrices, this.historyPeriod);
    return this.assetDetail.seriesForHistory(filtered, detail.symbol);
  }

  historyStatsFor(detail: AssetDetailViewModel): AssetHistoryStats | null {
    return this.assetDetail.historyStats(this.assetDetail.filterHistory(detail.historicalPrices, this.historyPeriod));
  }

  formatMoney(value: number | null | undefined, currency: string): string {
    return this.assetDetail.formatMoney(value, currency);
  }

  formatPercent(value: number | null | undefined): string {
    return this.assetDetail.formatPercent(value);
  }

  formatNumber(value: number | null | undefined): string {
    return this.assetDetail.formatNumber(value);
  }

  currencyLabel(currency: string): string {
    return this.assetDetail.currencyLabel(currency);
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) {
      return 'N/D';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/D';
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  minimumStatusLabel(status: MinimumPerformanceBySymbol['status'] | MinimumPerformanceLot['status'] | null | undefined): string {
    switch (status) {
      case 'beats-minimum':
        return 'Supera minimo';
      case 'below-minimum':
        return 'Debajo minimo';
      case 'missing-calendar':
        return 'Sin calendario';
      case 'not-applicable':
        return 'No comparable';
      case 'review':
      default:
        return 'Revisar';
    }
  }

  trackByOperationId(index: number, operation: AssetDetailViewModel['operations'][number]): string {
    return operation.id || `${index}`;
  }

  private refreshHistory(): void {
    if (!this.detail) {
      this.historyChartSeries = [];
      this.historyStats = null;
      return;
    }
    const filtered = this.assetDetail.filterHistory(this.detail.historicalPrices, this.historyPeriod);
    this.historyChartSeries = this.assetDetail.seriesForHistory(filtered, this.detail.symbol);
    this.historyStats = this.assetDetail.historyStats(filtered);
  }

  private refreshMinimumPerformance(snapshot: PortfolioAppState): void {
    if (!this.symbol || !snapshot.dataset) {
      this.minimumPerformance = null;
      this.minimumPerformanceLots = [];
      return;
    }

    const minimums = this.minimumPerformanceService.buildMinimumPerformanceBySymbol(snapshot);
    const positionCurrency = this.detail?.position.currency ?? null;
    const match = minimums.find((item) => item.symbol.toUpperCase() === this.symbol && (!positionCurrency || item.currency.toUpperCase() === positionCurrency.toUpperCase()))
      ?? minimums.find((item) => item.symbol.toUpperCase() === this.symbol)
      ?? null;

    this.minimumPerformance = match;
    this.minimumPerformanceLots = match?.lots ?? [];
  }

  private dateValue(value: string | Date | null | undefined): number {
    if (!value) return 0;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
