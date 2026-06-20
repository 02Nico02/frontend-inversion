import { Injectable } from '@angular/core';
import { PortfolioAppState } from './portfolio-state.service';
import {
  PortfolioMilestone,
  PortfolioMilestoneBuildResult,
  PortfolioMilestoneCategory,
  PortfolioMilestoneSeverity,
  PortfolioUnavailableMilestone
} from '../models/portfolio-milestones.model';
import { parseExcelDate } from '../utils/value-parsing.utils';
import { MonthlyInvestmentSummary } from '../models/portfolio.models';

interface MilestoneCandidate {
  milestone: PortfolioMilestone;
  priority: number;
}

interface DailyBalancePoint {
  date: Date;
  value: number;
  source: string;
}

interface MonthlyPoint extends MonthlyInvestmentSummary {
  date: Date | null;
}

const THRESHOLDS = [1_000_000, 5_000_000, 10_000_000];
const HIGHLIGHTED_MILESTONE_IDS = [
  'max-monthly-value',
  'value-threshold-1000000',
  'value-threshold-5000000',
  'largest-daily-increase',
  'largest-daily-drop',
  'largest-monthly-result'
];
const CATEGORY_ORDER: PortfolioMilestoneCategory[] = [
  'portfolio-value',
  'daily-balance',
  'monthly-performance',
  'real-performance',
  'contribution',
  'benchmark-minimum'
];

@Injectable({ providedIn: 'root' })
export class PortfolioMilestonesService {
  buildMilestoneReport(snapshot: PortfolioAppState): PortfolioMilestoneBuildResult {
    const balances = this.buildDailyBalances(snapshot);
    const monthly = this.buildMonthlyPoints(snapshot);
    const detected: MilestoneCandidate[] = [];
    const unavailable: PortfolioUnavailableMilestone[] = [];

    const valueResult = this.buildValueMilestones(monthly);
    detected.push(...valueResult.detected);
    unavailable.push(...valueResult.unavailable);

    const dailyResult = this.buildDailyChangeMilestones(balances);
    detected.push(...dailyResult.detected);
    unavailable.push(...dailyResult.unavailable);

    detected.push(...this.buildMonthlyNominalMilestones(monthly));
    detected.push(...this.buildMonthlyRealMilestones(monthly));
    unavailable.push(...this.buildBenchmarkMinimumMilestones());

    const orderedDetected = detected
      .sort((left, right) => {
        const categoryDelta = CATEGORY_ORDER.indexOf(left.milestone.category) - CATEGORY_ORDER.indexOf(right.milestone.category);
        if (categoryDelta !== 0) {
          return categoryDelta;
        }
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }
        const leftDate = this.dateValue(left.milestone.date);
        const rightDate = this.dateValue(right.milestone.date);
        if (leftDate !== rightDate) {
          return rightDate - leftDate;
        }
        return left.milestone.title.localeCompare(right.milestone.title, 'es');
      })
      .map((item) => item.milestone);

    const orderedUnavailable = unavailable.sort((left, right) => {
      const categoryDelta = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }
      return left.title.localeCompare(right.title, 'es');
    });

    return {
      detected: orderedDetected,
      unavailable: orderedUnavailable
    };
  }

  buildMilestones(snapshot: PortfolioAppState): PortfolioMilestone[] {
    return this.buildMilestoneReport(snapshot).detected;
  }

  getLatestMilestone(milestones: PortfolioMilestone[]): PortfolioMilestone | null {
    return [...milestones]
      .filter((item) => this.dateValue(item.date) > 0)
      .sort((left, right) => this.dateValue(right.date) - this.dateValue(left.date))[0] ?? null;
  }

  getHighlightedMilestones(milestones: PortfolioMilestone[]): PortfolioMilestone[] {
    const byId = new Map(milestones.map((item) => [item.id, item] as const));
    const highlighted: PortfolioMilestone[] = [];

    for (const id of HIGHLIGHTED_MILESTONE_IDS) {
      const milestone = byId.get(id);
      if (milestone && !highlighted.some((item) => item.id === milestone.id)) {
        highlighted.push(milestone);
      }
    }

    for (const milestone of milestones) {
      if (highlighted.length >= 6) {
        break;
      }
      if (!highlighted.some((item) => item.id === milestone.id)) {
        highlighted.push(milestone);
      }
    }

    return highlighted.slice(0, 6);
  }

  hasIncompleteData(snapshot: PortfolioAppState): boolean {
    const balances = snapshot.dataset?.dailyBalances?.filter((item) => item.balance !== null && item.balance !== undefined).length ?? 0;
    const monthly = snapshot.dataset?.monthlySummary?.length ?? 0;
    return balances < 2 || monthly === 0;
  }

  getCategoryOrder(): PortfolioMilestoneCategory[] {
    return [...CATEGORY_ORDER];
  }

  getCategoryLabel(category: PortfolioMilestoneCategory): string {
    switch (category) {
      case 'portfolio-value':
        return 'Valor del portafolio';
      case 'daily-balance':
        return 'Balance diario';
      case 'monthly-performance':
        return 'Rendimiento mensual';
      case 'real-performance':
        return 'Rendimiento real';
      case 'contribution':
        return 'Aportes';
      case 'benchmark-minimum':
        return 'Benchmark mínimo';
      default:
        return 'Hito';
    }
  }

  private buildValueMilestones(monthly: MonthlyPoint[]): { detected: MilestoneCandidate[]; unavailable: PortfolioUnavailableMilestone[] } {
    const detected: MilestoneCandidate[] = [];
    const unavailable: PortfolioUnavailableMilestone[] = [];
    const values = monthly.filter((item) => item.endValue !== null && item.endValue !== undefined);

    for (const threshold of THRESHOLDS) {
      const hit = values.find((item) => (item.endValue ?? 0) >= threshold);
      if (!hit) {
        unavailable.push({
          id: `first-month-above-${threshold}`,
          title: `Primer mes arriba de ${this.formatThreshold(threshold)}`,
          category: 'portfolio-value',
          reason: values.length ? 'not-reached' : 'missing-data',
          description: values.length
            ? `Todavía no se detectó un valor mensual del portafolio por encima de ${this.formatThreshold(threshold)}.`
            : 'No hay historial mensual suficiente para calcular este hito.',
          requiredSource: 'HistorialMensualReconstruido'
        });
        continue;
      }

      detected.push({
        priority: 1 + THRESHOLDS.indexOf(threshold),
        milestone: {
          id: `value-threshold-${threshold}`,
          title: `Primer mes arriba de ${this.formatThreshold(threshold)}`,
          description: `El valor mensual superó por primera vez los ${this.formatThreshold(threshold)}.`,
          category: 'portfolio-value',
          severity: 'positive',
          date: hit.date,
          value: hit.endValue,
          percent: hit.endValue !== null && hit.endValue !== undefined ? ((hit.endValue / threshold) - 1) * 100 : null,
          currency: 'ARS',
          source: 'HistorialMensualReconstruido'
        }
      });
    }

    const max = values.reduce<MonthlyPoint | null>((best, current) => {
      const currentValue = current.endValue ?? -Infinity;
      const bestValue = best?.endValue ?? -Infinity;
      if (!best || currentValue > bestValue) {
        return current;
      }
      return best;
    }, null);

    if (max) {
      detected.push({
        priority: 1,
        milestone: {
          id: 'max-monthly-value',
          title: 'Máximo valor mensual del portafolio',
          description: 'Mayor valor mensual registrado en el historial reconstruido.',
          category: 'portfolio-value',
          severity: 'positive',
          date: max.date,
          value: max.endValue,
          percent: null,
          currency: 'ARS',
          source: 'HistorialMensualReconstruido'
        }
      });
    }

    return { detected, unavailable };
  }

  private buildDailyChangeMilestones(balances: DailyBalancePoint[]): { detected: MilestoneCandidate[]; unavailable: PortfolioUnavailableMilestone[] } {
    const unavailable: PortfolioUnavailableMilestone[] = [];
    if (!balances.length) {
      unavailable.push({
        id: 'daily-portfolio-ath',
        title: 'Máximo histórico diario del portafolio',
        category: 'portfolio-value',
        reason: 'missing-data',
        description: 'No se detectó una serie diaria de valor total del portafolio. Tabla14 representa balance diario, no valor acumulado.',
        requiredSource: 'Serie diaria de valor total'
      });
      return { detected: [], unavailable };
    }

    const bestIncrease = balances.reduce<DailyBalancePoint | null>((best, current) => {
      if (!best || current.value > best.value) {
        return current;
      }
      return best;
    }, null);
    const worstDecrease = balances.reduce<DailyBalancePoint | null>((worst, current) => {
      if (!worst || current.value < worst.value) {
        return current;
      }
      return worst;
    }, null);

    const detected: MilestoneCandidate[] = [];
    if (bestIncrease && bestIncrease.value > 0) {
      detected.push({
        priority: 3,
        milestone: {
          id: 'largest-daily-increase',
          title: 'Mayor ganancia diaria',
          description: `Mayor variación diaria positiva registrada: ${this.formatSignedMoney(bestIncrease.value)}.`,
          category: 'daily-balance',
          severity: 'positive',
          date: bestIncrease.date,
          value: bestIncrease.value,
          percent: null,
          currency: 'ARS',
          source: bestIncrease.source
        }
      });
    }

    if (worstDecrease && worstDecrease.value < 0) {
      detected.push({
        priority: 3,
        milestone: {
          id: 'largest-daily-drop',
          title: 'Mayor pérdida diaria',
          description: `Mayor variación diaria negativa registrada: ${this.formatSignedMoney(worstDecrease.value)}.`,
          category: 'daily-balance',
          severity: 'negative',
          date: worstDecrease.date,
          value: worstDecrease.value,
          percent: null,
          currency: 'ARS',
          source: worstDecrease.source
        }
      });
    }

    return { detected, unavailable };
  }

  private buildMonthlyNominalMilestones(monthly: MonthlyPoint[]): MilestoneCandidate[] {
    if (!monthly.length) {
      return [];
    }

    const validVariation = monthly.filter((item) => item.variationPercent !== null && item.variationPercent !== undefined);
    const validPurchases = monthly.filter((item) => item.purchases !== null && item.purchases !== undefined);
    const validResults = monthly.filter((item) => item.result !== null && item.result !== undefined);

    const result: MilestoneCandidate[] = [];
    const bestNominal = validVariation.reduce<MonthlyPoint | null>((best, current) => {
      if (!best || (current.variationPercent ?? -Infinity) > (best.variationPercent ?? -Infinity)) {
        return current;
      }
      return best;
    }, null);
    const worstNominal = validVariation.reduce<MonthlyPoint | null>((worst, current) => {
      if (!worst || (current.variationPercent ?? Infinity) < (worst.variationPercent ?? Infinity)) {
        return current;
      }
      return worst;
    }, null);
    const maxContribution = this.findMaximumContribution(validPurchases);
    const maxResult = validResults.reduce<MonthlyPoint | null>((best, current) => {
      if (!best || (current.result ?? -Infinity) > (best.result ?? -Infinity)) {
        return current;
      }
      return best;
    }, null);

    if (bestNominal) {
      result.push(this.monthlyPercentMilestone(bestNominal, 'best-nominal-month', 'Mejor mes nominal', 'Mayor variación % mensual.', 'positive', 'monthly-performance', 4, bestNominal.variationPercent));
    }
    if (worstNominal) {
      result.push(this.monthlyPercentMilestone(worstNominal, 'worst-nominal-month', 'Peor mes nominal', 'Menor variación % mensual.', 'negative', 'monthly-performance', 4, worstNominal.variationPercent));
    }
    if (maxContribution) {
      result.push(maxContribution);
    }
    if (maxResult) {
      result.push(this.monthlyMoneyMilestone(maxResult, 'largest-monthly-result', 'Mes con mayor resultado por rendimiento', 'Mayor resultado mensual registrado.', 'positive', 'monthly-performance', 4, maxResult.result));
    }

    return result;
  }

  private buildMonthlyRealMilestones(monthly: MonthlyPoint[]): MilestoneCandidate[] {
    const validReal = monthly.filter((item) => item.realReturnPercent !== null && item.realReturnPercent !== undefined);
    if (!validReal.length) {
      return [];
    }

    const result: MilestoneCandidate[] = [];
    const bestReal = validReal.reduce<MonthlyPoint | null>((best, current) => {
      if (!best || (current.realReturnPercent ?? -Infinity) > (best.realReturnPercent ?? -Infinity)) {
        return current;
      }
      return best;
    }, null);
    const worstReal = validReal.reduce<MonthlyPoint | null>((worst, current) => {
      if (!worst || (current.realReturnPercent ?? Infinity) < (worst.realReturnPercent ?? Infinity)) {
        return current;
      }
      return worst;
    }, null);
    const firstPositive = validReal.find((item) => (item.realReturnPercent ?? 0) > 0) ?? null;

    if (bestReal) {
      result.push(this.monthlyPercentMilestone(bestReal, 'best-real-month', 'Mejor mes real', 'Mayor rendimiento real % mensual.', 'positive', 'real-performance', 5, bestReal.realReturnPercent));
    }
    if (worstReal) {
      result.push(this.monthlyPercentMilestone(worstReal, 'worst-real-month', 'Peor mes real', 'Menor rendimiento real % mensual.', 'negative', 'real-performance', 5, worstReal.realReturnPercent));
    }
    if (firstPositive) {
      result.push(this.monthlyPercentMilestone(firstPositive, 'first-positive-real-month', 'Primer mes positivo real', 'Primer mes con rendimiento real % mayor a cero.', 'positive', 'real-performance', 5, firstPositive.realReturnPercent));
    }

    return result;
  }

  private buildBenchmarkMinimumMilestones(): PortfolioUnavailableMilestone[] {
    return [
      {
        id: 'first-month-above-minimum-benchmark',
        title: 'Primer mes que supera benchmark mínimo',
        category: 'benchmark-minimum',
        reason: 'not-supported-yet',
        description: 'No hay una serie histórica confiable de benchmark mínimo mensual para calcular este hito.',
        requiredSource: 'Benchmark mínimo histórico'
      }
    ];
  }

  private findMaximumContribution(monthly: MonthlyPoint[]): MilestoneCandidate | null {
    let best: { item: MonthlyPoint; value: number; net: boolean } | null = null;

    for (const item of monthly) {
      const purchases = item.purchases ?? null;
      const sales = item.sales ?? null;
      const hasNet = purchases !== null && sales !== null;
      const value = hasNet ? (purchases ?? 0) - (sales ?? 0) : purchases;
      if (value === null) {
        continue;
      }
      if (!best || value > best.value) {
        best = { item, value, net: hasNet };
      }
    }

    if (!best) {
      return null;
    }

    const description = best.net
      ? 'Mayor aporte neto del mes calculado como compras menos ventas.'
      : 'Mayor aporte bruto del mes según compras.';

    return {
      priority: 4,
      milestone: {
        id: 'largest-contribution-month',
        title: 'Mes con mayor aporte',
        description,
        category: 'contribution',
        severity: 'neutral',
        date: best.item.date ?? null,
        value: best.value,
        percent: null,
        currency: 'ARS',
        source: 'HistorialMensualReconstruido'
      }
    };
  }

  private monthlyMoneyMilestone(
    item: MonthlyPoint,
    id: string,
    title: string,
    description: string,
    severity: PortfolioMilestoneSeverity,
    category: PortfolioMilestoneCategory,
    priority: number,
    moneyValue: number | null
  ): MilestoneCandidate {
    return {
      priority,
      milestone: {
        id,
        title,
        description,
        category,
        severity,
        date: item.date,
        value: moneyValue,
        percent: null,
        currency: 'ARS',
        source: 'HistorialMensualReconstruido'
      }
    };
  }

  private monthlyPercentMilestone(
    item: MonthlyPoint,
    id: string,
    title: string,
    description: string,
    severity: PortfolioMilestoneSeverity,
    category: PortfolioMilestoneCategory,
    priority: number,
    percentValue: number | null
  ): MilestoneCandidate {
    return {
      priority,
      milestone: {
        id,
        title,
        description,
        category,
        severity,
        date: item.date,
        value: null,
        percent: percentValue,
        currency: null,
        source: 'HistorialMensualReconstruido'
      }
    };
  }

  private buildDailyBalances(snapshot: PortfolioAppState): DailyBalancePoint[] {
    const ordered = [...(snapshot.dataset?.dailyBalances ?? [])]
      .filter((item) => item.balance !== null && item.balance !== undefined)
      .sort((left, right) => this.dateValue(left.date) - this.dateValue(right.date));

    const deduped = new Map<string, DailyBalancePoint>();
    for (const item of ordered) {
      const date = parseExcelDate(item.date);
      if (!date) {
        continue;
      }
      deduped.set(date.toISOString().slice(0, 10), {
        date,
        value: Number(item.balance ?? 0),
        source: 'Tabla14'
      });
    }

    return Array.from(deduped.values()).sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  private buildMonthlyPoints(snapshot: PortfolioAppState): MonthlyPoint[] {
    return [...(snapshot.dataset?.monthlySummary ?? [])]
      .map((item) => ({
        ...item,
        date: this.monthLabelToDate(item.month, item.year)
      }))
      .filter((item) => item.date !== null)
      .sort((left, right) => this.dateValue(left.date) - this.dateValue(right.date));
  }

  private monthLabelToDate(monthLabel: string | null | undefined, year: number | null | undefined): Date | null {
    if (!monthLabel) {
      return null;
    }

    const parsedDate = parseExcelDate(monthLabel);
    if (parsedDate) {
      return parsedDate;
    }

    const normalized = String(monthLabel)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const monthMap: Record<string, number> = {
      ene: 0,
      enero: 0,
      feb: 1,
      febrero: 1,
      mar: 2,
      marzo: 2,
      abr: 3,
      abril: 3,
      may: 4,
      mayo: 4,
      jun: 5,
      junio: 5,
      jul: 6,
      julio: 6,
      ago: 7,
      agosto: 7,
      sep: 8,
      sept: 8,
      septiembre: 8,
      oct: 9,
      octubre: 9,
      nov: 10,
      noviembre: 10,
      dic: 11,
      diciembre: 11
    };

    const parts = normalized.split(/[\s\/\-_.]+/).filter(Boolean);
    let monthIndex: number | null = null;
    let parsedYear = year ?? null;

    for (const part of parts) {
      if (monthIndex === null && monthMap[part] !== undefined) {
        monthIndex = monthMap[part];
        continue;
      }
      if (parsedYear === null && /^\d{2,4}$/.test(part)) {
        const numeric = Number(part);
        parsedYear = numeric < 100 ? (numeric < 70 ? 2000 + numeric : 1900 + numeric) : numeric;
      }
    }

    if (monthIndex === null || parsedYear === null) {
      return null;
    }

    const date = new Date(Date.UTC(parsedYear, monthIndex, 1));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private dateValue(value: string | Date | null | undefined): number {
    if (!value) {
      return 0;
    }
    const date = value instanceof Date ? value : parseExcelDate(value);
    return date ? date.getTime() : 0;
  }

  private formatThreshold(value: number): string {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  private formatSignedMoney(value: number): string {
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
    return `${value >= 0 ? '+' : '-'}$ ${formatted}`;
  }
}
