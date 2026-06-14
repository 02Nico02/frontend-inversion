import { Injectable } from '@angular/core';
import { DailyBalance, PortfolioPosition } from '../models/portfolio.models';
import { CanonicalCurrency } from './currency-mapper.service';
import { parseExcelDate } from '../utils/value-parsing.utils';

export interface ChartPoint {
  label: string;
  value: number;
  count?: number;
  percentage?: number;
  total?: number;
  tooltip?: string;
  date?: string | null;
  changeAmount?: number | null;
  changePercent?: number | null;
}

export interface SeriesPoint {
  label: string;
  value: number;
  date?: string | null;
  changeAmount?: number | null;
  changePercent?: number | null;
  tooltip?: string;
  count?: number;
  percentage?: number;
  total?: number;
}

@Injectable({ providedIn: 'root' })
export class ChartDataService {
  distributionBySymbol(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL' = 'ALL', topN = 10): ChartPoint[] {
    const filtered = this.filterByCurrency(positions, currency);
    const total = filtered.reduce((sum, position) => sum + position.currentValue, 0);
    return filtered
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, topN)
      .map((position) => ({
        label: position.symbol,
        value: position.currentValue,
        count: 1,
        total,
        percentage: total > 0 ? (position.currentValue / total) * 100 : 0,
        tooltip: `${position.symbol} · ${position.currency} · ${position.currentValue}`
      }));
  }

  distributionByCurrency(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL' = 'ALL'): ChartPoint[] {
    return this.toBucketChart(
      this.filterByCurrency(positions, currency),
      (position) => position.currency || 'UNKNOWN',
      (position) => position.currentValue
    );
  }

  distributionByPositionType(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL' = 'ALL'): ChartPoint[] {
    return this.toBucketChart(
      this.filterByCurrency(positions, currency),
      (position) => position.positionType || 'Sin clasificar',
      (position) => position.currentValue
    );
  }

  distributionByAssetType(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL' = 'ALL'): ChartPoint[] {
    return this.toBucketChart(
      this.filterByCurrency(positions, currency),
      (position) => position.assetType || 'Sin clasificar',
      (position) => position.currentValue
    );
  }

  distributionBySector(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL' = 'ALL'): ChartPoint[] {
    return this.toBucketChart(
      this.filterByCurrency(positions, currency),
      (position) => position.classification?.sector || position.sector || 'Sin sector',
      (position) => position.currentValue
    );
  }

  distributionBySubsector(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL' = 'ALL'): ChartPoint[] {
    return this.toBucketChart(
      this.filterByCurrency(positions, currency),
      (position) => position.classification?.subsector || position.subsector || 'Sin subsector',
      (position) => position.currentValue
    );
  }

  distributionByRegion(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL' = 'ALL'): ChartPoint[] {
    return this.toBucketChart(
      this.filterByCurrency(positions, currency),
      (position) => position.classification?.region || position.region || 'Sin región',
      (position) => position.currentValue
    );
  }

  balanceSeries(balances: DailyBalance[]): SeriesPoint[] {
    const ordered = [...balances]
      .filter((item) => item.balance !== null && item.balance !== undefined)
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date))
      .slice(-120);
    return ordered.map((item, index) => {
      const value = Number(item.balance ?? 0);
      const previous = index > 0 ? Number(ordered[index - 1].balance ?? 0) : null;
      const changeAmount = previous !== null ? value - previous : null;
      const changePercent = previous && previous !== 0 ? ((value - previous) / previous) * 100 : null;
      return {
        label: String(item.date ?? item.month ?? ''),
        value,
        date: String(item.date ?? item.month ?? ''),
        changeAmount,
        changePercent,
        tooltip: `${String(item.date ?? item.month ?? '')} · ${value}`
      };
    });
  }

  priceSeries(values: Array<{ date: string | Date | null; price: number | null }>, symbol?: string): SeriesPoint[] {
    const ordered = [...values]
      .filter((item) => item.price !== null && item.price !== undefined)
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date))
      .slice(-180);
    return ordered.map((item, index) => {
      const value = Number(item.price ?? 0);
      const previous = index > 0 ? Number(ordered[index - 1].price ?? 0) : null;
      const changeAmount = previous !== null ? value - previous : null;
      const changePercent = previous && previous !== 0 ? ((value - previous) / previous) * 100 : null;
      const label = String(item.date ?? '');
      return {
        label,
        value,
        date: label,
        changeAmount,
        changePercent,
        tooltip: `${symbol ?? ''} ${label} · ${value}`
      };
    });
  }

  private toBucketChart(
    positions: PortfolioPosition[],
    labelFn: (position: PortfolioPosition) => string,
    valueFn: (position: PortfolioPosition) => number
  ): ChartPoint[] {
    const bucket = new Map<string, number>();
    const countBucket = new Map<string, number>();
    for (const position of positions) {
      const key = labelFn(position);
      bucket.set(key, (bucket.get(key) ?? 0) + valueFn(position));
      countBucket.set(key, (countBucket.get(key) ?? 0) + 1);
    }
    const total = Array.from(bucket.values()).reduce((sum, value) => sum + value, 0);
    return Array.from(bucket.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label,
        value,
        count: countBucket.get(label) ?? 0,
        total,
        percentage: total > 0 ? (value / total) * 100 : 0,
        tooltip: `${label} · ${value}`
      }));
  }

  private filterByCurrency(positions: PortfolioPosition[], currency: CanonicalCurrency | 'ALL'): PortfolioPosition[] {
    if (currency === 'ALL') {
      return [...positions];
    }
    return positions.filter((position) => position.currency === currency);
  }

  private dateValue(value: string | Date | null | undefined): number {
    if (!value) {
      return 0;
    }
    const date = parseExcelDate(value);
    return date ? date.getTime() : 0;
  }
}
