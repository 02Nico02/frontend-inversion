import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { AssetDetailService, AssetDetailViewModel, AssetHistoryStats } from '../../../asset-detail/services/asset-detail.service';
import { MinimumPerformanceBySymbol, MinimumPerformanceLot } from '../../../../core/models/minimum-performance.model';
import { MinimumPerformanceService } from '../../../../core/services/minimum-performance.service';
import { InvestmentMovementLotAdjustment } from '../../../../core/models/investment-movements.model';
import {
  MinimumBalanceTrendSymbolPoint,
  MinimumBalanceTrendSymbolReport
} from '../../../../core/services/portfolio-minimum-balance-trend.service';
import { PortfolioMinimumBalanceTrendService } from '../../../../core/services/portfolio-minimum-balance-trend.service';

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
  minimumBalanceTrendReport: MinimumBalanceTrendSymbolReport | null = null;
  minimumBalanceTrendSeries: MinimumBalanceTrendSymbolPoint[] = [];
  minimumBalanceTrendStats: {
    initial: number | null;
    final: number | null;
    max: number | null;
    min: number | null;
    latest: number | null;
    latestDate: string | null;
    variationAmount: number | null;
    variationPercent: number | null;
  } | null = null;

  private symbol = '';
  private subscription?: Subscription;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly assetDetail: AssetDetailService,
    private readonly minimumPerformanceService: MinimumPerformanceService,
    private readonly minimumBalanceTrendService: PortfolioMinimumBalanceTrendService,
    private readonly fileDownloadService: FileDownloadService
  ) {}

  ngOnInit(): void {
    this.subscription = combineLatest([this.route.paramMap, this.state.state$]).subscribe(([params, snapshot]) => {
      this.symbol = params.get('symbol')?.toUpperCase() ?? '';
      this.detail = this.symbol ? this.assetDetail.buildViewModel(snapshot, this.symbol) : null;
      this.operationPageIndex = 0;
      this.refreshMinimumPerformance(snapshot);
      this.refreshHistory(snapshot);
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

  summaryResultAmount(detail: AssetDetailViewModel): number {
    return detail.movementSummary?.adjustedResultAmount ?? detail.summaryMetrics.resultAmount;
  }

  summaryResultPercent(detail: AssetDetailViewModel): number | null {
    return detail.movementSummary?.adjustedResultPercent ?? detail.summaryMetrics.resultPercent;
  }

  hasMovementAdjustments(detail: AssetDetailViewModel): boolean {
    return Boolean(detail.movementSummary?.hasAdjustments);
  }

  minimumUsesAdjustedComparableValue(detail: AssetDetailViewModel): boolean {
    return Boolean(this.minimumPerformance?.usesAmortizationAdjustedBenchmark);
  }  minimumAdjustmentTooltip(detail: AssetDetailViewModel): string | null {
    const minimum = this.minimumPerformance;
    if (!minimum || !minimum.usesAmortizationAdjustedBenchmark) {
      return null;
    }

    return [
      'El valor actual no cambia; solo se ajusta la comparación contra el mínimo esperado para reflejar rentas y amortizaciones cobradas.',
      'Para comparar contra el mínimo esperado se usa:',
      'Total actual + rentas cobradas + amortizaciones cobradas.',
      'El mínimo esperado ajustado incluye capital amortizado, benchmark acumulado por tramos y capital remanente ajustado.',
      `Total actual: ${this.formatMoney(minimum.marketCurrentValue ?? minimum.currentValue, detail.position.currency)}`,
      `Rentas cobradas: ${this.formatMoney(minimum.incomeAmount, detail.position.currency)}`,
      `Amortizaciones cobradas: ${this.formatMoney(minimum.capitalReturnedAmount, detail.position.currency)}`,
      `Valor comparable: ${this.formatMoney(minimum.comparableValue, detail.position.currency)}`,
      `Capital amortizado incluido en mínimo: ${this.formatMoney(minimum.capitalReturnedAmount, detail.position.currency)}`,
      `Benchmark acumulado por tramos: ${this.formatMoney(minimum.benchmarkAccruedAmount, detail.position.currency)}`,
      `Capital remanente ajustado: ${this.formatMoney(minimum.remainingExposedCapital, detail.position.currency)}`,
      `Mínimo esperado ajustado: ${this.formatMoney(minimum.minimumExpectedValue, detail.position.currency)}`,
      `Vs mínimo ajustado: ${this.formatMoney(minimum.valueVsMinimumAmount, detail.position.currency)}`
    ].join(' ');
  }  movementTooltip(detail: AssetDetailViewModel): string | null {
    if (!detail.movementSummary || !detail.movementSummary.hasAdjustments) {
      return detail.movementEntries.length ? 'Movimientos detectados, pero no se pudieron asignar completamente a lotes.' : null;
    }

    return [
      'El valor actual no cambia; solo se ajusta el resultado para reflejar rentas y amortizaciones cobradas.',
      `Movimientos aplicados: ${detail.movementSummary.movementsCount}`,
      `Rentas cobradas: ${this.formatMoney(detail.movementSummary.incomeAmount, detail.position.currency)}`,
      `Amortizaciones cobradas: ${this.formatMoney(detail.movementSummary.capitalReturnedAmount, detail.position.currency)}`,
      `Resultado sin ajuste: ${this.formatMoney(detail.summaryMetrics.resultAmount, detail.position.currency)}`,
      `Resultado ajustado: ${this.formatMoney(detail.movementSummary.adjustedResultAmount, detail.position.currency)}`
    ].join(' ');
  }

  movementSummaryNotes(detail: AssetDetailViewModel): string {
    if (detail.movementSummary?.hasAdjustments) {
      return 'El valor actual no cambia; solo se ajusta el resultado para reflejar rentas y amortizaciones cobradas.';
    }
    if (detail.movementEntries.length) {
      return 'Movimientos detectados, pero no se pudieron asignar completamente a lotes.';
    }
    return 'Sin movimientos de inversión aplicables.';
  }

  movementSummaryCount(detail: AssetDetailViewModel): number {
    return detail.movementSummary?.movementsCount ?? detail.movementEntries.length;
  }

  movementDeltaAmount(detail: AssetDetailViewModel): number | null {
    if (!detail.movementSummary?.hasAdjustments) {
      return null;
    }
    return detail.movementSummary.adjustedResultAmount - detail.summaryMetrics.resultAmount;
  }

  movementDeltaPercent(detail: AssetDetailViewModel): number | null {
    if (!detail.movementSummary?.hasAdjustments) {
      return null;
    }
    const adjusted = detail.movementSummary.adjustedResultPercent;
    const base = detail.summaryMetrics.resultPercent;
    if (adjusted === null || base === null) {
      return null;
    }
    return adjusted - base;
  }

  lotMinimumUsesAdjustedComparableValue(lot: MinimumPerformanceLot): boolean {
    return Boolean(lot.usesAmortizationAdjustedBenchmark);
  }  lotMinimumAdjustmentTooltip(lot: MinimumPerformanceLot, currency: string): string | null {
    if (!lot.usesAmortizationAdjustedBenchmark) {
      return null;
    }

    return [
      'El valor actual no cambia; solo se ajusta la comparación contra el mínimo esperado para reflejar rentas y amortizaciones cobradas.',
      'Para comparar contra el mínimo esperado se usa:',
      'Total actual + rentas cobradas + amortizaciones cobradas.',
      'El mínimo esperado ajustado incluye capital amortizado, benchmark acumulado por tramos y capital remanente ajustado.',
      `Total actual: ${this.formatMoney(lot.marketCurrentValue ?? lot.currentValue, currency)}`,
      `Rentas cobradas: ${this.formatMoney(lot.incomeAmount, currency)}`,
      `Amortizaciones cobradas: ${this.formatMoney(lot.capitalReturnedAmount, currency)}`,
      `Valor comparable: ${this.formatMoney(lot.comparableValue, currency)}`,
      `Capital amortizado incluido en mínimo: ${this.formatMoney(lot.capitalReturnedAmount, currency)}`,
      `Benchmark acumulado por tramos: ${this.formatMoney(lot.benchmarkAccruedAmount, currency)}`,
      `Capital remanente ajustado: ${this.formatMoney(lot.remainingExposedCapital, currency)}`,
      `Mínimo esperado ajustado: ${this.formatMoney(lot.minimumExpectedValue, currency)}`,
      `Vs mínimo ajustado: ${this.formatMoney(lot.valueVsMinimumAmount, currency)}`
    ].join(' ');
  }  lotAdjustmentFor(operation: AssetDetailViewModel['operations'][number], detail: AssetDetailViewModel): InvestmentMovementLotAdjustment | null {
    return detail.movementLots.find((lot) => lot.operationId === operation.id) ?? null;
  }

  lotResultAmount(operation: AssetDetailViewModel['operations'][number], detail: AssetDetailViewModel): number | null {
    return this.lotAdjustmentFor(operation, detail)?.adjustedResultAmount ?? this.operationResult(operation);
  }

  lotResultPercent(operation: AssetDetailViewModel['operations'][number], detail: AssetDetailViewModel): number | null {
    return this.lotAdjustmentFor(operation, detail)?.adjustedResultPercent ?? this.operationResultPercent(operation);
  }

  lotResultAdjusted(operation: AssetDetailViewModel['operations'][number], detail: AssetDetailViewModel): boolean {
    return Boolean(this.lotAdjustmentFor(operation, detail)?.movementsCount);
  }

  movementRows(detail: AssetDetailViewModel) {
    return [...detail.movementEntries].sort((a, b) => {
      const left = this.dateValue(a.date);
      const right = this.dateValue(b.date);
      return left > right ? -1 : left < right ? 1 : 0;
    });
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

  exportMinimumBalanceTrendDiagnostic(): void {
    const snapshot = this.state.snapshot;
    if (!this.detail || !snapshot.dataset) {
      return;
    }

    const latestPoint = this.minimumBalanceTrendSeries.at(-1) ?? null;
    const latestPointDate = latestPoint?.date ?? null;
    const latestDateDebug = latestPointDate
      ? this.minimumBalanceTrendService.debugMinimumBalanceTrendForDate(snapshot, latestPointDate)
      : null;
    const latestSymbolDateDebug = latestDateDebug
      ? {
          ...latestDateDebug,
          lots: latestDateDebug.lots.filter((lot) => lot.symbol.trim().toUpperCase() === this.symbol)
        }
      : null;

    const report = {
      generatedAt: new Date().toISOString(),
      symbol: this.symbol,
      currency: this.detail.position.currency,
      detail: {
        symbol: this.detail.symbol,
        headerSummary: this.detail.headerSummary,
        position: this.detail.position,
        summaryMetrics: this.detail.summaryMetrics,
        movementSummary: this.detail.movementSummary,
        classificationReview: this.detail.classificationReview,
        manualAlerts: this.detail.manualAlerts,
        calculatedAlerts: this.detail.calculatedAlerts,
        signalAlerts: this.detail.signalAlerts,
        movementEntries: this.detail.movementEntries
      },
      minimumPerformance: this.minimumPerformance,
      minimumPerformanceLots: this.minimumPerformanceLots,
      minimumBalanceTrend: {
        report: this.minimumBalanceTrendReport,
        series: this.minimumBalanceTrendSeries,
        stats: this.minimumBalanceTrendStats
      },
      latestHistoricalPointDebug: latestSymbolDateDebug,
      currentComparison: snapshot.dataset
        ? this.minimumPerformanceService.buildMinimumPerformanceSummary(snapshot)
        : null
    };

    const filename = `diagnostico-vs-minimo-${this.symbol.toLowerCase()}-${latestPointDate ?? new Date().toISOString().slice(0, 10)}.json`;
    this.fileDownloadService.downloadText(filename, JSON.stringify(report, null, 2), 'application/json;charset=utf-8');
  }

  private refreshHistory(snapshot?: PortfolioAppState): void {
    if (!this.detail) {
      this.historyChartSeries = [];
      this.historyStats = null;
      this.minimumBalanceTrendReport = null;
      this.minimumBalanceTrendSeries = [];
      this.minimumBalanceTrendStats = null;
      return;
    }
    const filtered = this.assetDetail.filterHistory(this.detail.historicalPrices, this.historyPeriod);
    this.historyChartSeries = this.assetDetail.seriesForHistory(filtered, this.detail.symbol);
    this.historyStats = this.assetDetail.historyStats(filtered);

    const state = snapshot ?? this.state.snapshot;
    if (state?.dataset) {
      this.minimumBalanceTrendReport = this.minimumBalanceTrendService.buildTrendBySymbol(state, this.detail.symbol, 'monthly');
      this.minimumBalanceTrendSeries = this.minimumBalanceTrendReport.points;
      this.minimumBalanceTrendStats = this.buildMinimumBalanceTrendStats(this.minimumBalanceTrendSeries);
    } else {
      this.minimumBalanceTrendReport = null;
      this.minimumBalanceTrendSeries = [];
      this.minimumBalanceTrendStats = null;
    }
  }

  private buildMinimumBalanceTrendStats(points: MinimumBalanceTrendSymbolPoint[]): {
    initial: number | null;
    final: number | null;
    max: number | null;
    min: number | null;
    latest: number | null;
    latestDate: string | null;
    variationAmount: number | null;
    variationPercent: number | null;
  } | null {
    if (!points.length) {
      return null;
    }

    const values = points.map((item) => item.value);
    const initial = values[0] ?? null;
    const final = values[values.length - 1] ?? null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const latest = values.at(-1) ?? final;

    return {
      initial,
      final,
      max,
      min,
      latest,
      latestDate: points.at(-1)?.date ?? null,
      variationAmount: initial !== null && final !== null ? final - initial : null,
      variationPercent: initial !== null && initial !== 0 && final !== null ? ((final - initial) / initial) * 100 : null
    };
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
