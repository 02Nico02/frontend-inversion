import { Injectable } from '@angular/core';
import { MinimumPerformanceService } from './minimum-performance.service';
import { PortfolioAppState } from './portfolio-state.service';
import {
  MinimumBalanceTrendPoint,
  MinimumBalanceTrendStatus,
  MinimumBalanceTrendSummary
} from '../models/portfolio-minimum-balance-trend.model';

@Injectable({ providedIn: 'root' })
export class PortfolioMinimumBalanceTrendService {
  constructor(private readonly minimumPerformance: MinimumPerformanceService) {}

  buildTrend(snapshot: PortfolioAppState): MinimumBalanceTrendSummary {
    const minimumSummary = this.minimumPerformance.buildMinimumPerformanceSummary(snapshot);
    const bySymbol = this.minimumPerformance.buildMinimumPerformanceBySymbol(snapshot);
    const warnings = [...minimumSummary.notes];

    const arsLots = bySymbol.filter((item) => item.currency === 'ARS');
    const underMinimumLots = arsLots.filter((item) => (item.valueVsMinimumAmount ?? 0) < 0);
    const positionsBelowMinimumCount = underMinimumLots.length;
    const totalDeficitBelowMinimumARS = underMinimumLots.reduce((sum, item) => sum + Math.abs(item.valueVsMinimumAmount ?? 0), 0);

    const points = this.buildHistoricalPoints(snapshot);
    const trendStatus = this.resolveTrendStatus(points);
    const trendLabel = this.trendLabel(trendStatus);
    const bestHistoricalPoint = this.bestPoint(points);
    const worstHistoricalPoint = this.worstPoint(points);
    const currentBalance = minimumSummary.balanceVsMinimumArs;
    const currentPercent = minimumSummary.balanceVsMinimumPercentArs;

    if (!points.length) {
      warnings.push('No hay serie histórica confiable de Balance vs mínimo ARS.');
    }

    return {
      currentBalanceVsMinimumARS: currentBalance,
      currentBalanceVsMinimumPercent: currentPercent,
      bestHistoricalBalanceARS: bestHistoricalPoint?.balanceVsMinimumARS ?? null,
      bestHistoricalDate: bestHistoricalPoint?.date ?? null,
      worstHistoricalBalanceARS: worstHistoricalPoint?.balanceVsMinimumARS ?? null,
      worstHistoricalDate: worstHistoricalPoint?.date ?? null,
      change30dARS: this.deltaAtDays(points, 30),
      change90dARS: this.deltaAtDays(points, 90),
      change30dPercentPoints: this.deltaPercentAtDays(points, 30),
      change90dPercentPoints: this.deltaPercentAtDays(points, 90),
      trendStatus,
      trendLabel,
      positionsBelowMinimumCount,
      totalDeficitBelowMinimumARS,
      points,
      source: 'MinimumPerformanceService',
      warnings: this.uniqueWarnings(warnings)
    };
  }

  private buildHistoricalPoints(snapshot: PortfolioAppState): MinimumBalanceTrendPoint[] {
    // No existe una serie histórica confiable de balance vs mínimo en el snapshot actual.
    // Devolver vacío evita inventar valores o reutilizar Tabla14 como si fuera un total acumulado.
    void snapshot;
    return [];
  }

  private resolveTrendStatus(points: MinimumBalanceTrendPoint[]): MinimumBalanceTrendStatus {
    if (points.length < 2) {
      return 'not-available';
    }
    const current = points.at(-1) ?? null;
    const previous = this.closestPoint(points, 30);
    if (!current || !previous || current.balanceVsMinimumPercent === null || previous.balanceVsMinimumPercent === null) {
      return 'not-available';
    }
    const delta = current.balanceVsMinimumPercent - previous.balanceVsMinimumPercent;
    if (delta > 1) {
      return 'improving';
    }
    if (delta < -1) {
      return 'deteriorating';
    }
    return 'stable';
  }

  private trendLabel(status: MinimumBalanceTrendStatus): string {
    switch (status) {
      case 'improving':
        return 'Mejorando';
      case 'deteriorating':
        return 'Deteriorándose';
      case 'stable':
        return 'Estable';
      case 'not-available':
      default:
        return 'Sin historial suficiente';
    }
  }

  private bestPoint(points: MinimumBalanceTrendPoint[]): MinimumBalanceTrendPoint | null {
    return points.reduce<MinimumBalanceTrendPoint | null>((best, current) => {
      if (!best || current.balanceVsMinimumARS > best.balanceVsMinimumARS) {
        return current;
      }
      return best;
    }, null);
  }

  private worstPoint(points: MinimumBalanceTrendPoint[]): MinimumBalanceTrendPoint | null {
    return points.reduce<MinimumBalanceTrendPoint | null>((worst, current) => {
      if (!worst || current.balanceVsMinimumARS < worst.balanceVsMinimumARS) {
        return current;
      }
      return worst;
    }, null);
  }

  private deltaAtDays(points: MinimumBalanceTrendPoint[], days: number): number | null {
    const current = points.at(-1) ?? null;
    const previous = this.closestPoint(points, days);
    if (!current || !previous) {
      return null;
    }
    return current.balanceVsMinimumARS - previous.balanceVsMinimumARS;
  }

  private deltaPercentAtDays(points: MinimumBalanceTrendPoint[], days: number): number | null {
    const current = points.at(-1) ?? null;
    const previous = this.closestPoint(points, days);
    if (!current || !previous || current.balanceVsMinimumPercent === null || previous.balanceVsMinimumPercent === null) {
      return null;
    }
    return current.balanceVsMinimumPercent - previous.balanceVsMinimumPercent;
  }

  private closestPoint(points: MinimumBalanceTrendPoint[], days: number): MinimumBalanceTrendPoint | null {
    if (points.length < 2) {
      return null;
    }
    const current = points.at(-1);
    if (!current) {
      return null;
    }
    const currentDate = this.asDate(current.date);
    if (!currentDate) {
      return points.at(-2) ?? null;
    }

    const target = currentDate.getTime() - days * 24 * 60 * 60 * 1000;
    let candidate: MinimumBalanceTrendPoint | null = null;
    for (const point of points) {
      const pointDate = this.asDate(point.date);
      if (!pointDate) {
        continue;
      }
      if (pointDate.getTime() <= target) {
        candidate = point;
      }
    }
    return candidate ?? points[0] ?? null;
  }

  private asDate(value: Date | string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private uniqueWarnings(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
  }
}
