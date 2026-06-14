import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ExcelImportService } from './core/services/excel-import.service';
import { PortfolioCalculatorService } from './core/services/portfolio-calculator.service';
import { PortfolioStateService, PortfolioAppState } from './core/services/portfolio-state.service';
import { ChartDataService } from './core/services/chart-data.service';
import { AlertMapperService, CombinedAlert } from './core/services/alert-mapper.service';
import { PortfolioValidationService } from './core/services/portfolio-validation.service';
import { CurrencyMapperService, CanonicalCurrency } from './core/services/currency-mapper.service';
import { PortfolioHealthService } from './core/services/portfolio-health.service';
import { PortfolioConcentrationService } from './core/services/portfolio-concentration.service';
import { parseExcelDate } from './core/utils/value-parsing.utils';
import { ImportPanelComponent } from './shared/components/import-panel.component';
import { ValidationSummaryComponent } from './shared/components/validation-summary.component';
import { PositionsTableComponent } from './shared/components/positions-table.component';
import { HistoricalSymbolComboboxComponent, HistoricalSymbolOption } from './shared/components/historical-symbol-combobox.component';
import { AssetDetailDrawerComponent } from './shared/components/asset-detail-drawer.component';
import { SimpleChartComponent } from './shared/components/simple-chart.component';
import { DashboardSummaryPanelComponent } from './dashboard-summary-panel/dashboard-summary-panel.component';
import { PortfolioPosition, DailyBalance } from './core/models/portfolio.models';
import { ConcentrationReport, DataReviewReport } from './core/models/analysis.models';

interface HistoricalStats {
  initial: number;
  final: number;
  variationAmount: number;
  variationPercent: number | null;
  latest: number;
  latestDate: string | null;
  latestChangeAmount: number | null;
  latestChangePercent: number | null;
  max: number;
  maxDate: string | null;
  min: number;
  minDate: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface BalanceStats extends HistoricalStats {}

type DatePeriod = 'ALL' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'CUSTOM';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ImportPanelComponent, ValidationSummaryComponent, PositionsTableComponent, AssetDetailDrawerComponent, HistoricalSymbolComboboxComponent, SimpleChartComponent, DashboardSummaryPanelComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.css']
})
export class DashboardPageComponent {
  selectedHistoricalSymbol = '';
  priceSearchTerm = '';
  selectedDetailSymbol: string | null = null;
  pricePeriod: DatePeriod = 'ALL';
  priceRangeStart = '';
  priceRangeEnd = '';
  balancePeriod: DatePeriod = 'ALL';
  balanceRangeStart = '';
  balanceRangeEnd = '';
  chartCurrencyFilter: CanonicalCurrency | 'ALL' = 'ALL';
  distributionTopN = 10;
  private readonly derivedCache = new WeakMap<PortfolioAppState, Map<string, unknown>>();

  get state$() {
    return this.portfolioState.state$;
  }

  constructor(
    private readonly excelImport: ExcelImportService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly portfolioState: PortfolioStateService,
    private readonly chartData: ChartDataService,
    private readonly alertMapper: AlertMapperService,
    private readonly validationService: PortfolioValidationService,
    private readonly currencyMapper: CurrencyMapperService,
    private readonly healthService: PortfolioHealthService,
    private readonly concentrationService: PortfolioConcentrationService
  ) {}

  private memoizeStateValue<T>(state: PortfolioAppState, key: string, factory: () => T): T {
    let cache = this.derivedCache.get(state);
    if (!cache) {
      cache = new Map<string, unknown>();
      this.derivedCache.set(state, cache);
    }
    if (cache.has(key)) {
      return cache.get(key) as T;
    }
    const value = factory();
    cache.set(key, value);
    return value;
  }

  async handleFile(file: File): Promise<void> {
    this.portfolioState.setLoading(file.name);
    try {
      const workbook = await this.excelImport.importWorkbook(file);
      const dataset = this.calculator.buildDataset(workbook.tables);
      const summary = this.calculator.buildSummary(dataset);
      const validation = this.validationService.validateDataset(workbook.validation, dataset);
      const alerts = [
        ...this.alertMapper.combine(dataset.manualAlerts, dataset.calculatedAlerts, dataset.positions),
        ...this.alertMapper.buildSignals(dataset.signals)
      ];
      const enrichedPositions = this.calculator.enrichPositions(dataset.positions, dataset.classifications);

      const initialSymbol = dataset.historicalPrices[0]?.symbol || enrichedPositions[0]?.symbol || '';
      this.selectedHistoricalSymbol = initialSymbol;
      this.priceSearchTerm = '';
      this.selectedDetailSymbol = null;
      this.pricePeriod = 'ALL';
      this.priceRangeStart = '';
      this.priceRangeEnd = '';
      this.balancePeriod = 'ALL';
      this.balanceRangeStart = '';
      this.balanceRangeEnd = '';
      this.chartCurrencyFilter = 'ALL';
      this.distributionTopN = 10;

      this.portfolioState.setReady({
        status: validation.errors.length ? 'warning' : 'ready',
        fileName: file.name,
        importedAt: new Date().toISOString(),
        workbook: {
          ...workbook,
          validation
        },
        dataset,
        summary,
        combinedAlerts: alerts,
        charts: {
          symbolDistribution: this.chartData.distributionBySymbol(enrichedPositions),
          currencyDistribution: this.chartData.distributionByCurrency(enrichedPositions),
          positionTypeDistribution: this.chartData.distributionByPositionType(enrichedPositions),
          assetTypeDistribution: this.chartData.distributionByAssetType(enrichedPositions),
          sectorDistribution: this.chartData.distributionBySector(enrichedPositions),
          subsectorDistribution: this.chartData.distributionBySubsector(enrichedPositions),
          regionDistribution: this.chartData.distributionByRegion(enrichedPositions),
          balanceSeries: this.chartData.balanceSeries(dataset.dailyBalances),
          priceSeries: []
        },
        validationErrors: validation.errors,
        validationWarnings: validation.warnings
      });
    } catch (error) {
      this.portfolioState.setError(error instanceof Error ? error.message : 'No se pudo importar el workbook');
    }
  }

  visiblePositions(state: PortfolioAppState): PortfolioPosition[] {
    return this.memoizeStateValue(state, 'visiblePositions', () => {
      return state.dataset ? this.calculator.enrichPositions(state.dataset.positions, state.dataset.classifications) : [];
    });
  }

  symbolDistribution(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `symbolDistribution:${this.chartCurrencyFilter}:${this.distributionTopN}`, () =>
      this.chartData.distributionBySymbol(this.visiblePositions(state), this.chartCurrencyFilter, this.distributionTopN)
    );
  }

  currencyDistribution(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `currencyDistribution:${this.chartCurrencyFilter}`, () =>
      this.chartData.distributionByCurrency(this.visiblePositions(state), this.chartCurrencyFilter)
    );
  }

  positionTypeDistribution(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `positionTypeDistribution:${this.chartCurrencyFilter}`, () =>
      this.chartData.distributionByPositionType(this.visiblePositions(state), this.chartCurrencyFilter)
    );
  }

  assetTypeDistribution(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `assetTypeDistribution:${this.chartCurrencyFilter}`, () =>
      this.chartData.distributionByAssetType(this.visiblePositions(state), this.chartCurrencyFilter)
    );
  }

  sectorDistribution(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `sectorDistribution:${this.chartCurrencyFilter}`, () =>
      this.chartData.distributionBySector(this.visiblePositions(state), this.chartCurrencyFilter)
    );
  }

  subsectorDistribution(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `subsectorDistribution:${this.chartCurrencyFilter}`, () =>
      this.chartData.distributionBySubsector(this.visiblePositions(state), this.chartCurrencyFilter)
    );
  }

  regionDistribution(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `regionDistribution:${this.chartCurrencyFilter}`, () =>
      this.chartData.distributionByRegion(this.visiblePositions(state), this.chartCurrencyFilter)
    );
  }

  historicalSpeciesOptions(state: PortfolioAppState): HistoricalSymbolOption[] {
    return this.memoizeStateValue(state, 'historicalSpeciesOptions', () => {
      const symbols = Array.from(new Set(state.dataset?.historicalPrices.map((item) => item.symbol).filter(Boolean) ?? []))
        .sort((a, b) => a.localeCompare(b, 'es'));
      return symbols
        .map((symbol) => ({
          symbol,
          label: this.historyOptionLabel(state, symbol),
          searchText: this.historyOptionSearchText(state, symbol)
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    });
  }

  selectedHistoricalLabel(state: PortfolioAppState): string | null {
    return this.memoizeStateValue(state, `selectedHistoricalLabel:${this.selectedHistoricalSymbol}`, () => {
      const option = this.historicalSpeciesOptions(state).find((item) => item.symbol === this.selectedHistoricalSymbol);
      return option?.label ?? (this.selectedHistoricalSymbol || null);
    });
  }

  selectedHistoricalCurrency(state: PortfolioAppState): string {
    return this.memoizeStateValue(state, `selectedHistoricalCurrency:${this.selectedHistoricalSymbol}`, () => {
      const position = this.visiblePositions(state).find((item) => item.symbol === this.selectedHistoricalSymbol);
      return position?.currency || 'UNKNOWN';
    });
  }

  historicalRecordCount(state: PortfolioAppState): number {
    return this.memoizeStateValue(state, `historicalRecordCount:${this.selectedHistoricalSymbol}:${this.pricePeriod}:${this.priceRangeStart}:${this.priceRangeEnd}`, () =>
      this.filteredHistoricalPrices(state).length
    );
  }

  historicalPriceSeries(state: PortfolioAppState): Array<{ label: string; value: number; date?: string | null; changeAmount?: number | null; changePercent?: number | null }> {
    return this.memoizeStateValue(state, `historicalPriceSeries:${this.selectedHistoricalSymbol}:${this.pricePeriod}:${this.priceRangeStart}:${this.priceRangeEnd}`, () => {
      const ordered = this.filteredHistoricalPrices(state);
      return ordered
        .map((item, index) => {
          const value = Number(item.price ?? 0);
          const previous = index > 0 ? Number(ordered[index - 1].price ?? 0) : null;
          return {
            label: this.formatDateLabel(item.date) ?? String(item.month ?? ''),
            value,
            date: this.formatDateLabel(item.date),
            changeAmount: previous !== null ? value - previous : null,
            changePercent: previous && previous !== 0 ? ((value - previous) / previous) * 100 : null
          };
        })
        .filter((item) => item.label);
    });
  }

  historicalPriceStats(state: PortfolioAppState): HistoricalStats | null {
    return this.memoizeStateValue(state, `historicalPriceStats:${this.selectedHistoricalSymbol}:${this.pricePeriod}:${this.priceRangeStart}:${this.priceRangeEnd}`, () =>
      this.computeSeriesStats(this.historicalPriceSeries(state))
    );
  }

  alertsByGroup(state: PortfolioAppState, group: 'manual' | 'calculated'): CombinedAlert[] {
    return this.memoizeStateValue(state, `alertsByGroup:${group}`, () => state.combinedAlerts.filter((alert) => alert.group === group));
  }

  signalAlerts(state: PortfolioAppState, period: '5D' | '30D'): CombinedAlert[] {
    return this.memoizeStateValue(state, `signalAlerts:${period}`, () => state.combinedAlerts.filter((alert) => alert.group === 'signal' && alert.period === period));
  }

  dataReviewReport(state: PortfolioAppState): DataReviewReport | null {
    return this.memoizeStateValue(state, 'dataReviewReport', () => {
      if (!state.dataset || !state.workbook) {
        return null;
      }
      return this.healthService.buildReport(state.dataset, state.workbook.validation);
    });
  }

  dataReviewSummary(state: PortfolioAppState) {
    return this.dataReviewReport(state)?.summary ?? null;
  }

  dataReviewFindings(state: PortfolioAppState) {
    return this.dataReviewReport(state)?.findings ?? [];
  }

  concentrationReport(state: PortfolioAppState): ConcentrationReport | null {
    return this.memoizeStateValue(state, `concentrationReport:${this.chartCurrencyFilter}`, () => {
      if (!state.dataset) {
        return null;
      }
      const scope: 'ALL' | 'ARS' | 'USD' = this.chartCurrencyFilter === 'ARS' || this.chartCurrencyFilter === 'USD' ? this.chartCurrencyFilter : 'ALL';
      return this.concentrationService.buildReport(this.visiblePositions(state), scope);
    });
  }

  concentrationChartSeries(state: PortfolioAppState): Array<{ label: string; value: number }> {
    return this.memoizeStateValue(state, `concentrationChartSeries:${this.chartCurrencyFilter}`, () => {
      const report = this.concentrationReport(state);
      if (!report) {
        return [];
      }
      return [
        { label: 'Top 1', value: report.top1Percent },
        { label: 'Top 3', value: report.top3Percent },
        { label: 'Top 5', value: report.top5Percent },
        { label: 'Top 10', value: report.top10Percent }
      ];
    });
  }

  concentrationRanking(state: PortfolioAppState) {
    return this.concentrationReport(state)?.ranking ?? [];
  }

  openDetail(symbol: string): void {
    this.selectedDetailSymbol = symbol;
  }

  closeDetail(): void {
    this.selectedDetailSymbol = null;
  }

  private filteredHistoricalPrices(state: PortfolioAppState) {
    return this.memoizeStateValue(state, `filteredHistoricalPrices:${this.selectedHistoricalSymbol}:${this.pricePeriod}:${this.priceRangeStart}:${this.priceRangeEnd}`, () => {
      const dataset = state.dataset?.historicalPrices ?? [];
      const selected = dataset.filter((item) => item.symbol === this.selectedHistoricalSymbol && item.price !== null);
      return this.filterHistoricalByPeriod(selected, this.pricePeriod, this.priceRangeStart, this.priceRangeEnd);
    });
  }

  private filteredBalances(state: PortfolioAppState): DailyBalance[] {
    return this.memoizeStateValue(state, `filteredBalances:${this.balancePeriod}:${this.balanceRangeStart}:${this.balanceRangeEnd}`, () => {
      const dataset = state.dataset?.dailyBalances ?? [];
      return this.filterHistoricalByPeriod(
        dataset.filter((item) => item.balance !== null),
        this.balancePeriod,
        this.balanceRangeStart,
        this.balanceRangeEnd
      );
    });
  }

  private historyOptionLabel(state: PortfolioAppState, symbol: string): string {
    const position = this.visiblePositions(state).find((item) => item.symbol === symbol);
    const classification = position?.classification;
    const asset = position?.assetType || classification?.type || null;
    const sector = classification?.sector || position?.sector || null;
    const subsector = classification?.subsector || position?.subsector || null;
    const region = classification?.region || position?.region || null;
    const parts = [asset, subsector || sector, region].filter(Boolean);
    return parts.length ? `${symbol} - ${parts.join(' / ')}` : symbol;
  }

  private historyOptionSearchText(state: PortfolioAppState, symbol: string): string {
    const position = this.visiblePositions(state).find((item) => item.symbol === symbol);
    const classification = position?.classification;
    return [
      symbol,
      position?.assetType,
      classification?.type,
      classification?.sector,
      classification?.subsector,
      classification?.region,
      position?.sector,
      position?.subsector,
      position?.region
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private filterHistoricalByPeriod<T extends { date: string | Date | null }>(
    values: T[],
    period: DatePeriod,
    startDate: string,
    endDate: string
  ): T[] {
    if (!values.length) {
      return [];
    }
    const ordered = [...values].sort((a, b) => this.sortDateValue(a.date) - this.sortDateValue(b.date));
    const latest = ordered.at(-1)?.date ?? null;
    const latestDate = latest ? this.toDate(latest) : null;
    const start = startDate ? this.toDate(startDate) : null;
    const end = endDate ? this.toDate(endDate) : null;
    return ordered.filter((item) => {
      const date = this.toDate(item.date);
      if (!date) {
        return false;
      }
      if (period === 'CUSTOM') {
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      }
      if (period === 'ALL' || !latestDate) {
        return true;
      }
      const threshold = this.periodStart(latestDate, period);
      return threshold ? date >= threshold : true;
    });
  }

  private periodStart(reference: Date, period: DatePeriod): Date | null {
    const date = new Date(reference);
    switch (period) {
      case '1M':
        date.setMonth(date.getMonth() - 1);
        return date;
      case '3M':
        date.setMonth(date.getMonth() - 3);
        return date;
      case '6M':
        date.setMonth(date.getMonth() - 6);
        return date;
      case 'YTD':
        return new Date(date.getFullYear(), 0, 1);
      case '1Y':
        date.setFullYear(date.getFullYear() - 1);
        return date;
      default:
        return null;
    }
  }

  private toDate(value: string | Date | null): Date | null {
    if (!value) {
      return null;
    }
    return parseExcelDate(value);
  }

  private computeSeriesStats(series: Array<{ label: string; value: number }>): HistoricalStats | null {
    if (!series.length) {
      return null;
    }
    const values = series.map((point) => point.value);
    const initial = values[0];
    const final = values[values.length - 1];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const latest = values[values.length - 1];
    const previous = values.length > 1 ? values[values.length - 2] : null;
    const maxIndex = values.indexOf(max);
    const minIndex = values.indexOf(min);
    return {
      initial,
      final,
      variationAmount: final - initial,
      variationPercent: initial > 0 ? ((final - initial) / initial) * 100 : null,
      latest,
      latestDate: series[series.length - 1]?.label ?? null,
      latestChangeAmount: previous !== null ? latest - previous : null,
      latestChangePercent: previous && previous !== 0 ? ((latest - previous) / previous) * 100 : null,
      max,
      maxDate: series[maxIndex]?.label ?? null,
      min,
      minDate: series[minIndex]?.label ?? null,
      startDate: series[0]?.label ?? null,
      endDate: series[series.length - 1]?.label ?? null
    };
  }

  balanceSeries(state: PortfolioAppState): Array<{ label: string; value: number; date?: string | null; changeAmount?: number | null; changePercent?: number | null }> {
    return this.filteredBalances(state).map((item, index, list) => {
      const value = Number(item.balance ?? 0);
      const previous = index > 0 ? Number(list[index - 1].balance ?? 0) : null;
      return {
        label: this.formatDateLabel(item.date) ?? String(item.month ?? ''),
        value,
        date: this.formatDateLabel(item.date),
        changeAmount: previous !== null ? value - previous : null,
        changePercent: previous && previous !== 0 ? ((value - previous) / previous) * 100 : null
      };
    });
  }

  balanceStats(state: PortfolioAppState): BalanceStats | null {
    const series = this.balanceSeries(state);
    return this.computeSeriesStats(series);
  }

  currencyLabel(currency: string): string {
    return this.currencyMapper.getCurrencyLabel(currency);
  }

  formatMoney(value: number | null | undefined, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
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

  formatDateLabel(value: string | Date | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const date = parseExcelDate(value);
    if (!date) {
      return String(value);
    }
    return new Intl.DateTimeFormat('es-AR').format(date);
  }

  private sortedBalances(state: PortfolioAppState): DailyBalance[] {
    return [...(state.dataset?.dailyBalances ?? [])]
      .filter((item) => item.balance !== null && item.balance !== undefined)
      .sort((a, b) => this.sortDateValue(a.date) - this.sortDateValue(b.date));
  }

  private sortDateValue(value: string | Date | null): number {
    if (!value) {
      return 0;
    }
    const date = parseExcelDate(value);
    return date ? date.getTime() : 0;
  }
}

