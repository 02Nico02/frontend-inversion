import { Injectable } from '@angular/core';
import { CalculatedAlert, ManualAlert, MarketSignal, PortfolioPosition } from '../models/portfolio.models';

export interface CombinedAlert {
  symbol: string;
  status: string;
  currentPrice: number | null;
  targetPrice: number | null;
  distancePercent: number | null;
  note: string | null;
  priority: string;
  group: 'manual' | 'calculated' | 'signal';
  period?: '5D' | '30D' | null;
  signalType?: 'caida' | 'recuperacion' | null;
  startDate?: string | null;
  endDate?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AlertMapperService {
  combine(manualAlerts: ManualAlert[], calculatedAlerts: CalculatedAlert[], positions: PortfolioPosition[]): CombinedAlert[] {
    const currentPriceBySymbol = new Map(positions.map((position) => [position.symbol.toUpperCase(), position.currentPrice ?? null]));
    const alerts: CombinedAlert[] = [];

    for (const alert of manualAlerts) {
      const currentPrice = currentPriceBySymbol.get(alert.symbol.toUpperCase()) ?? null;
      const distancePercent = this.distance(alert.targetPrice, currentPrice);
      alerts.push({
        symbol: alert.symbol,
        status: this.manualStatus(alert.condition, alert.targetPrice, currentPrice, alert.status),
        currentPrice,
        targetPrice: alert.targetPrice,
        distancePercent,
        note: alert.notes,
        priority: 'manual',
        group: 'manual'
      });
    }

    for (const alert of calculatedAlerts) {
      const currentPrice = alert.currentPrice ?? currentPriceBySymbol.get(alert.symbol.toUpperCase()) ?? null;
      alerts.push({
        symbol: alert.symbol,
        status: alert.alert ?? 'calculada',
        currentPrice,
        targetPrice: alert.target,
        distancePercent: this.distance(alert.target, currentPrice),
        note: null,
        priority: alert.sourceTable ?? 'calculated',
        group: 'calculated'
      });
    }

    return alerts.sort((a, b) => Math.abs(a.distancePercent ?? Infinity) - Math.abs(b.distancePercent ?? Infinity));
  }

  buildSignals(signals: MarketSignal[]): CombinedAlert[] {
    return signals.map((signal) => ({
      symbol: signal.symbol,
      status: signal.signalType,
      currentPrice: signal.endPrice,
      targetPrice: signal.startPrice,
      distancePercent: signal.variationPercent,
      note: null,
      priority: signal.period === '30D' ? '30D' : '5D',
      group: 'signal',
      period: signal.period === '30D' ? '30D' : '5D',
      signalType: signal.signalType === 'recuperacion' ? 'recuperacion' : 'caida',
      startDate: signal.startDate ? String(signal.startDate) : null,
      endDate: signal.endDate ? String(signal.endDate) : null
    }));
  }

  private distance(target: number | null | undefined, current: number | null | undefined): number | null {
    if (target === null || target === undefined || current === null || current === undefined || current === 0) {
      return null;
    }
    return ((current - target) / target) * 100;
  }

  private manualStatus(
    condition: string | null | undefined,
    target: number | null | undefined,
    current: number | null | undefined,
    fallback: string | null | undefined
  ): string {
    if (!condition && fallback) {
      return fallback;
    }
    if (target === null || target === undefined || current === null || current === undefined) {
      return 'inactiva';
    }
    const normalizedCondition = String(condition ?? '').toLowerCase();
    const distance = this.distance(target, current);
    const near = distance !== null && Math.abs(distance) <= 5;
    const activated = normalizedCondition.includes('debajo') ? current <= target : normalizedCondition.includes('supera') ? current >= target : false;
    if (activated) {
      return 'activada';
    }
    if (near) {
      return 'cerca';
    }
    return 'lejos';
  }
}
