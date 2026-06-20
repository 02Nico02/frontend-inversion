import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HistoricalSymbolComboboxComponent, HistoricalSymbolOption } from '../../../../shared/components/historical-symbol-combobox/historical-symbol-combobox.component';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { ChartDataService } from '../../../../core/services/chart-data.service';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { PortfolioAppState } from '../../../../core/services/portfolio-state.service';
import { PortfolioMilestonesService } from '../../../../core/services/portfolio-milestones.service';
import { PortfolioMilestone } from '../../../../core/models/portfolio-milestones.model';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';
import { parseExcelDate } from '../../../../core/utils/value-parsing.utils';

type DatePeriod = 'ALL' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'CUSTOM';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, HistoricalSymbolComboboxComponent, SimpleChartComponent],
  templateUrl: './historical-page.component.html',
  styleUrls: ['./historical-page.component.scss'],
})
export class HistoricalPageComponent {
  selectedHistoricalSymbol = '';
  pricePeriod: DatePeriod = 'ALL';
  priceRangeStart = '';
  priceRangeEnd = '';
  balancePeriod: DatePeriod = 'YTD';
  balanceRangeStart = '';
  balanceRangeEnd = '';

  private cachedPriceSeriesKey = '';
  private cachedPriceSeries: ReturnType<ChartDataService['priceSeries']> = [];
  private cachedBalanceSeriesKey = '';
  private cachedBalanceSeries: ReturnType<ChartDataService['balanceSeries']> = [];
  private cachedMilestonesKey = '';
  private cachedMilestones: PortfolioMilestone[] = [];
  showAllMilestones = false;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly chartData: ChartDataService,
    private readonly currencyMapper: CurrencyMapperService,
    private readonly milestonesService: PortfolioMilestonesService,
    public readonly privacyMode: PrivacyModeService
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
    const cacheKey = [
      snapshot.importedAt ?? '',
      snapshot.fileName ?? '',
      snapshot.dataset?.historicalPrices.length ?? 0,
      this.selectedHistoricalSymbol,
      this.pricePeriod,
      this.priceRangeStart,
      this.priceRangeEnd
    ].join('|');
    if (cacheKey === this.cachedPriceSeriesKey) {
      return this.cachedPriceSeries;
    }
    const raw = (snapshot.dataset?.historicalPrices ?? []).filter((item) => item.symbol === this.selectedHistoricalSymbol && item.price !== null);
    this.cachedPriceSeries = this.chartData.priceSeries(this.filterHistoricalByPeriod(raw, this.pricePeriod, this.priceRangeStart, this.priceRangeEnd), this.selectedHistoricalSymbol);
    this.cachedPriceSeriesKey = cacheKey;
    return this.cachedPriceSeries;
  }

  balanceSeries(snapshot: PortfolioAppState) {
    const cacheKey = [
      snapshot.importedAt ?? '',
      snapshot.fileName ?? '',
      snapshot.dataset?.dailyBalances.length ?? 0,
      this.balancePeriod,
      this.balanceRangeStart,
      this.balanceRangeEnd
    ].join('|');
    if (cacheKey === this.cachedBalanceSeriesKey) {
      return this.cachedBalanceSeries;
    }
    const raw = (snapshot.dataset?.dailyBalances ?? []).filter((item) => item.balance !== null);
    this.cachedBalanceSeries = this.chartData.balanceSeries(this.filterHistoricalByPeriod(raw, this.balancePeriod, this.balanceRangeStart, this.balanceRangeEnd));
    this.cachedBalanceSeriesKey = cacheKey;
    return this.cachedBalanceSeries;
  }

  historicalMilestones(snapshot: PortfolioAppState): PortfolioMilestone[] {
    const cacheKey = [
      snapshot.importedAt ?? '',
      snapshot.fileName ?? '',
      snapshot.dataset?.dailyBalances.length ?? 0,
      snapshot.dataset?.monthlySummary.length ?? 0
    ].join('|');
    if (cacheKey === this.cachedMilestonesKey) {
      return this.cachedMilestones;
    }
    this.cachedMilestones = this.milestonesService.buildMilestones(snapshot);
    this.cachedMilestonesKey = cacheKey;
    return this.cachedMilestones;
  }

  visibleMilestones(snapshot: PortfolioAppState): PortfolioMilestone[] {
    const milestones = this.historicalMilestones(snapshot);
    return this.showAllMilestones ? milestones : this.milestonesService.getHighlightedMilestones(milestones);
  }

  latestMilestone(snapshot: PortfolioAppState): PortfolioMilestone | null {
    return this.milestonesService.getLatestMilestone(this.historicalMilestones(snapshot));
  }

  toggleMilestones(): void {
    this.showAllMilestones = !this.showAllMilestones;
  }

  hasMoreMilestones(snapshot: PortfolioAppState): boolean {
    return this.historicalMilestones(snapshot).length > this.milestonesService.getHighlightedMilestones(this.historicalMilestones(snapshot)).length;
  }

  hasIncompleteMilestones(snapshot: PortfolioAppState): boolean {
    return this.milestonesService.hasIncompleteData(snapshot) && this.historicalMilestones(snapshot).length > 0;
  }

  milestoneDate(value: string | Date | null): string {
    if (!value) {
      return 'N/D';
    }
    const date = value instanceof Date ? value : parseExcelDate(value);
    if (!date) {
      return 'N/D';
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  milestoneValue(milestone: PortfolioMilestone): string {
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    if (milestone.value !== null && milestone.currency) {
      return this.currencyMapper.formatCurrency(milestone.value, milestone.currency);
    }
    if (milestone.value !== null) {
      return this.currencyMapper.formatNumber(milestone.value);
    }
    if (milestone.percent !== null) {
      return this.currencyMapper.formatPercentage(milestone.percent);
    }
    return 'N/D';
  }

  milestonePercent(milestone: PortfolioMilestone): string {
    if (milestone.percent === null || milestone.percent === undefined) {
      return 'N/D';
    }
    return this.currencyMapper.formatPercentage(milestone.percent);
  }

  milestoneCategoryLabel(category: PortfolioMilestone['category']): string {
    switch (category) {
      case 'portfolio-value':
        return 'Valor total';
      case 'daily-balance':
        return 'Balance diario';
      case 'monthly-performance':
        return 'Mensual nominal';
      case 'real-performance':
        return 'Mensual real';
      case 'benchmark-minimum':
        return 'Benchmark';
      case 'contribution':
        return 'Aportes';
      default:
        return 'Hito';
    }
  }

  milestoneSeverityLabel(severity: PortfolioMilestone['severity']): string {
    switch (severity) {
      case 'positive':
        return 'Positivo';
      case 'negative':
        return 'Negativo';
      case 'neutral':
        return 'Neutro';
      case 'warning':
        return 'Aviso';
      default:
        return 'Hito';
    }
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
    return this.currencyMapper.formatNumber(value);
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
