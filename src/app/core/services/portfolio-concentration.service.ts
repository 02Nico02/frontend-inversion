import { Injectable } from '@angular/core';
import { PortfolioPosition } from '../models/portfolio.models';
import { ConcentrationDimensionSummary, ConcentrationRankingItem, ConcentrationReport } from '../models/analysis.models';

@Injectable({ providedIn: 'root' })
export class PortfolioConcentrationService {
  buildReport(positions: PortfolioPosition[], currencyScope: 'ALL' | 'ARS' | 'USD'): ConcentrationReport {
    const filtered = currencyScope === 'ALL' ? [...positions] : positions.filter((position) => position.currency === currencyScope);
    const ordered = [...filtered].sort((a, b) => b.currentValue - a.currentValue);
    const totalCurrentValue = ordered.reduce((sum, position) => sum + position.currentValue, 0);
    const ranking = ordered.slice(0, 20).map((position, index) => ({
      rank: index + 1,
      symbol: position.symbol,
      currency: position.currency,
      assetType: position.assetType ?? null,
      sector: position.sector ?? null,
      subsector: position.subsector ?? null,
      region: position.region ?? null,
      totalCurrentValue: position.currentValue,
      weightPercent: this.percent(position.currentValue, totalCurrentValue),
      cumulativeWeightPercent: this.percent(ordered.slice(0, index + 1).reduce((sum, item) => sum + item.currentValue, 0), totalCurrentValue)
    }));

    const top1Percent = this.topPercent(ordered, totalCurrentValue, 1);
    const top3Percent = this.topPercent(ordered, totalCurrentValue, 3);
    const top5Percent = this.topPercent(ordered, totalCurrentValue, 5);
    const top10Percent = this.topPercent(ordered, totalCurrentValue, 10);

    const largestPosition = ordered[0] ?? null;
    const largestSector = this.dimensionSummary(filtered, (position) => position.sector || 'Sin sector', 'Sector');
    const largestSubsector = this.dimensionSummary(filtered, (position) => position.subsector || 'Sin subsector', 'Subsector');
    const largestRegion = this.dimensionSummary(filtered, (position) => position.region || 'Sin región', 'Región');
    const largestAssetType = this.dimensionSummary(filtered, (position) => position.assetType || 'Sin clasificar', 'Tipo de activo');
    const species = this.dimensionSummary(filtered, (position) => position.symbol, 'Especie');

    const dimensionSummaries = [species, largestAssetType, largestSector, largestSubsector, largestRegion].filter(Boolean) as ConcentrationDimensionSummary[];
    const mixedCurrencies = new Set(filtered.map((position) => position.currency)).size > 1;

    return {
      currencyScope,
      totalCurrentValue,
      top1Percent,
      top3Percent,
      top5Percent,
      top10Percent,
      largestPosition,
      largestSector,
      largestSubsector,
      largestRegion,
      largestAssetType,
      ranking,
      dimensionSummaries,
      currencyWarning: currencyScope === 'ALL' && mixedCurrencies ? 'Sin conversión mezcla ARS y USD: usar solo como referencia visual.' : null
    };
  }

  private dimensionSummary(
    positions: PortfolioPosition[],
    labelFn: (position: PortfolioPosition) => string,
    dimension: ConcentrationDimensionSummary['dimension']
  ): ConcentrationDimensionSummary | null {
    const bucket = new Map<string, number>();
    for (const position of positions) {
      const label = labelFn(position);
      bucket.set(label, (bucket.get(label) ?? 0) + position.currentValue);
    }
    if (!bucket.size) {
      return null;
    }
    const ordered = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
    const total = ordered.reduce((sum, [, value]) => sum + value, 0);
    return {
      dimension,
      topLabel: ordered[0][0],
      topWeightPercent: this.percent(ordered[0][1], total),
      top3Labels: ordered.slice(0, 3).map(([label]) => label),
      categoryCount: ordered.length
    };
  }

  private topPercent(positions: PortfolioPosition[], total: number, topN: number): number {
    if (!positions.length || total <= 0) {
      return 0;
    }
    const topValue = positions.slice(0, topN).reduce((sum, position) => sum + position.currentValue, 0);
    return this.percent(topValue, total);
  }

  private percent(value: number, total: number): number {
    return total > 0 ? (value / total) * 100 : 0;
  }
}
