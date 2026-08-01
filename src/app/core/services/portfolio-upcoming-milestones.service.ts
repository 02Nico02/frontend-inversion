import { Injectable } from '@angular/core';
import { PortfolioUpcomingMilestone, PortfolioUpcomingMilestoneBreakdown } from '../models/portfolio-upcoming-milestone.model';
import { PortfolioAppState } from './portfolio-state.service';
import { parseExcelDate } from '../utils/value-parsing.utils';
import { PerformanceReferenceBundle, PerformanceReferenceService } from '../../features/decisions/services/performance-reference.service';

const MANUAL_GOALS_ARS = [10_000_000, 15_000_000, 20_000_000];

interface StrategyBucket {
  retirementAmountARS: number;
  savingsAmountARS: number;
  retirementAmountUSD: number;
  savingsAmountUSD: number;
}

interface ProjectionEstimate {
  months: number | null;
  mode: 'growth-and-contribution' | 'contribution-only' | 'not-estimable';
  note: string | null;
  annualRatePercent: number | null;
  monthlyRatePercent: number | null;
}

@Injectable({ providedIn: 'root' })
export class PortfolioUpcomingMilestonesService {
  private static readonly MAX_MONTHS = 600;

  constructor(private readonly performanceReferenceService: PerformanceReferenceService) {}

  buildUpcomingMilestones(snapshot: PortfolioAppState, monthlyContributionArs: number | null): PortfolioUpcomingMilestone[] {
    const performance = this.buildPerformanceReferences(snapshot);
    const nominal12mRatePercent = this.nominal12mRatePercent(performance);

    const goals: PortfolioUpcomingMilestone[] = [];

    const nextMillion = this.buildNextMillionGoal(snapshot, monthlyContributionArs, nominal12mRatePercent);
    if (nextMillion) {
      goals.push(nextMillion);
    }

    const historicalRecovery = this.buildHistoricalRecoveryGoal(snapshot, monthlyContributionArs, nominal12mRatePercent);
    if (historicalRecovery) {
      goals.push(historicalRecovery);
    }

    const strategyBalance = this.buildStrategyGuidanceGoal(snapshot);
    if (strategyBalance) {
      goals.push(strategyBalance);
    }

    const manualGoal = this.buildManualGoal(snapshot, monthlyContributionArs, nominal12mRatePercent);
    if (manualGoal && !goals.some((goal) => goal.currency === manualGoal.currency && goal.targetValue === manualGoal.targetValue)) {
      goals.push(manualGoal);
    }

    return goals;
  }

  private buildNextMillionGoal(
    snapshot: PortfolioAppState,
    monthlyContributionArs: number | null,
    nominal12mRatePercent: number | null
  ): PortfolioUpcomingMilestone | null {
    const currentValue = this.currentArsValue(snapshot);
    if (currentValue === null || currentValue < 0) {
      return this.notAvailable(
        'next-million-ars',
        'Próximo millón ARS',
        'No hay valor actual en ARS suficiente para calcular el próximo millón.',
        'PortfolioSummary.totalCurrentValue ARS'
      );
    }

    const million = 1_000_000;
    const targetValue = Math.floor(currentValue / million) * million + million;
    const remainingAmount = Math.max(0, targetValue - currentValue);
    const projection = this.estimateMonthsToTarget(currentValue, targetValue, monthlyContributionArs, nominal12mRatePercent);

    return {
      id: 'next-million-ars',
      title: 'Próximo millón ARS',
      description:
        remainingAmount <= 0
          ? 'El portafolio ya alcanzó ese escalón. El próximo objetivo es el siguiente millón.'
          : 'El próximo escalón de valor en ARS para el portafolio.',
      category: 'portfolio-value',
      status: remainingAmount <= 0 ? 'reached' : 'pending',
      currentValue,
      targetValue,
      remainingAmount,
      remainingPercent: targetValue > 0 ? (remainingAmount / targetValue) * 100 : null,
      currency: 'ARS',
      monthlyContribution: monthlyContributionArs,
      estimatedMonths: projection.months,
      estimationMode: projection.mode,
      estimationNote: projection.note,
      estimationAnnualRatePercent: projection.annualRatePercent,
      estimationMonthlyRatePercent: projection.monthlyRatePercent,
      source: 'PortfolioSummary.totalCurrentValue ARS'
    };
  }

  private buildHistoricalRecoveryGoal(
    snapshot: PortfolioAppState,
    monthlyContributionArs: number | null,
    nominal12mRatePercent: number | null
  ): PortfolioUpcomingMilestone | null {
    const currentValue = this.currentArsValue(snapshot);
    const maxMonthly = this.maxMonthlyValue(snapshot);
    if (currentValue === null || maxMonthly === null) {
      return this.notAvailable(
        'recover-monthly-max',
        'Recuperar máximo mensual histórico',
        'No hay datos mensuales suficientes para comparar el valor actual contra el máximo mensual histórico.',
        'HistorialMensualReconstruido'
      );
    }

    const remainingAmount = Math.max(0, maxMonthly - currentValue);
    const projection = this.estimateMonthsToTarget(currentValue, maxMonthly, monthlyContributionArs, nominal12mRatePercent);

    return {
      id: 'recover-monthly-max',
      title: 'Recuperar máximo mensual histórico',
      description:
        remainingAmount <= 0
          ? 'El portafolio está en máximo o por encima del máximo mensual registrado.'
          : 'Objetivo para volver a tocar el mejor valor mensual histórico detectado.',
      category: 'historical-recovery',
      status: remainingAmount <= 0 ? 'reached' : 'pending',
      currentValue,
      targetValue: maxMonthly,
      remainingAmount,
      remainingPercent: maxMonthly > 0 ? (remainingAmount / maxMonthly) * 100 : null,
      currency: 'ARS',
      monthlyContribution: monthlyContributionArs,
      estimatedMonths: projection.months,
      estimationMode: projection.mode,
      estimationNote: projection.note,
      estimationAnnualRatePercent: projection.annualRatePercent,
      estimationMonthlyRatePercent: projection.monthlyRatePercent,
      source: 'HistorialMensualReconstruido'
    };
  }

  private buildStrategyGuidanceGoal(snapshot: PortfolioAppState): PortfolioUpcomingMilestone | null {
    const rows = [...(snapshot.dataset?.strategicSplit ?? [])].sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
    if (!rows.length) {
      return this.notAvailable(
        'strategy-balance-guidance',
        'Distribución estratégica de aportes',
        'No hay datos suficientes del split estratégico para calcular la distribución entre Jubilación y Ahorro.',
        'Tabla35'
      );
    }

    const totals = rows.reduce<StrategyBucket>(
      (acc, row) => ({
        retirementAmountARS: acc.retirementAmountARS + Number(row.retirementAmountARS ?? 0),
        savingsAmountARS: acc.savingsAmountARS + Number(row.savingsAmountARS ?? 0),
        retirementAmountUSD: acc.retirementAmountUSD + Number(row.retirementAmountUSD ?? 0),
        savingsAmountUSD: acc.savingsAmountUSD + Number(row.savingsAmountUSD ?? 0)
      }),
      { retirementAmountARS: 0, savingsAmountARS: 0, retirementAmountUSD: 0, savingsAmountUSD: 0 }
    );

    const arsBreakdown = this.strategyBreakdown('ARS', totals.retirementAmountARS, totals.savingsAmountARS);
    const usdBreakdown = this.strategyBreakdown('USD', totals.retirementAmountUSD, totals.savingsAmountUSD);
    const breakdown = [arsBreakdown, usdBreakdown].filter((item): item is PortfolioUpcomingMilestoneBreakdown => Boolean(item));

    if (!breakdown.length) {
      return this.notAvailable(
        'strategy-balance-guidance',
        'Distribución estratégica de aportes',
        'No hay montos válidos para Jubilación y Ahorro en ARS o USD.',
        'Tabla35'
      );
    }

    return {
      id: 'strategy-balance-guidance',
      title: 'Distribución estratégica de aportes',
      description:
        'La referencia surge de los aportes y egresos acumulados. Sirve como guía para futuros aportes, no como obligación de rebalanceo por rendimiento.',
      category: 'strategy-balance',
      status: 'pending',
      currentValue: null,
      targetValue: null,
      remainingAmount: null,
      remainingPercent: null,
      currency: null,
      monthlyContribution: null,
      estimatedMonths: null,
      source: 'Tabla35',
      breakdown
    };
  }

  private buildManualGoal(
    snapshot: PortfolioAppState,
    monthlyContributionArs: number | null,
    nominal12mRatePercent: number | null
  ): PortfolioUpcomingMilestone | null {
    const currentValue = this.currentArsValue(snapshot);
    if (currentValue === null) {
      return null;
    }

    const targetValue = MANUAL_GOALS_ARS.find((goal) => goal > currentValue) ?? null;
    if (!targetValue) {
      return null;
    }

    const remainingAmount = targetValue - currentValue;
    const projection = this.estimateMonthsToTarget(currentValue, targetValue, monthlyContributionArs, nominal12mRatePercent);

    return {
      id: `manual-goal-${targetValue}`,
      title: `Meta manual ${this.formatMoney(targetValue)}`,
      description: 'Objetivo de referencia para visualizar un próximo escalón manual.',
      category: 'manual-goal',
      status: 'pending',
      currentValue,
      targetValue,
      remainingAmount,
      remainingPercent: targetValue > 0 ? (remainingAmount / targetValue) * 100 : null,
      currency: 'ARS',
      monthlyContribution: monthlyContributionArs,
      estimatedMonths: projection.months,
      estimationMode: projection.mode,
      estimationNote: projection.note,
      estimationAnnualRatePercent: projection.annualRatePercent,
      estimationMonthlyRatePercent: projection.monthlyRatePercent,
      source: 'Objetivos sugeridos'
    };
  }

  private strategyBreakdown(currency: 'ARS' | 'USD', retirementAmount: number, savingsAmount: number): PortfolioUpcomingMilestoneBreakdown | null {
    const total = retirementAmount + savingsAmount;
    if (total <= 0) {
      return null;
    }

    const retirementPercent = (retirementAmount / total) * 100;
    const savingsPercent = 100 - retirementPercent;

    return {
      currency,
      retirementPercent,
      savingsPercent,
      gapPercent: retirementPercent - savingsPercent,
      retirementAmount,
      savingsAmount,
      remainingAmount: Math.abs(retirementAmount - savingsAmount),
      estimatedMonths: null
    };
  }

  private currentArsValue(snapshot: PortfolioAppState): number | null {
    const byCurrency = snapshot.summary?.byCurrency ?? [];
    const ars = byCurrency.find((item) => String(item.currency).toUpperCase() === 'ARS');
    return ars ? ars.totalCurrentValue : null;
  }

  private maxMonthlyValue(snapshot: PortfolioAppState): number | null {
    const values = (snapshot.dataset?.monthlySummary ?? [])
      .map((item) => Number(item.endValue ?? NaN))
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return null;
    }
    return Math.max(...values);
  }

  private buildPerformanceReferences(snapshot: PortfolioAppState): PerformanceReferenceBundle {
    return this.performanceReferenceService.build(snapshot.dataset?.monthlySummary ?? [], snapshot.dataset?.monthlyPerformance ?? []);
  }

  private nominal12mRatePercent(performance: PerformanceReferenceBundle): number | null {
    const reference = performance.references.find(
      (item) => item.type === 'nominal' && item.period === '12M' && item.annualRatePercent !== null && !item.warning?.includes('suspicious')
    );
    return reference?.annualRatePercent ?? null;
  }

  private estimateMonthsToTarget(
    currentValue: number,
    targetValue: number,
    monthlyContribution: number | null,
    annualRatePercent: number | null
  ): ProjectionEstimate {
    const safeContribution = typeof monthlyContribution === 'number' && Number.isFinite(monthlyContribution) ? Math.max(0, monthlyContribution) : null;
    const monthlyRatePercent = annualRatePercent !== null && Number.isFinite(annualRatePercent)
      ? this.annualToMonthlyRatePercent(annualRatePercent)
      : null;
    const monthlyRate = monthlyRatePercent !== null ? monthlyRatePercent / 100 : null;

    if (targetValue <= currentValue) {
      return {
        months: 0,
        mode: monthlyRate !== null ? 'growth-and-contribution' : 'contribution-only',
        note: monthlyRate !== null
          ? 'La estimación usa el aporte mensual y el rendimiento nominal de los últimos 12 meses. No es una predicción, solo una proyección orientativa.'
          : 'El objetivo ya fue alcanzado.',
        annualRatePercent,
        monthlyRatePercent
      };
    }

    if (monthlyRate !== null) {
      return this.projectWithRate(currentValue, targetValue, safeContribution, annualRatePercent, monthlyRatePercent!, monthlyRate);
    }

    if (safeContribution !== null && safeContribution > 0) {
      return this.projectOnlyWithContributions(currentValue, targetValue, safeContribution);
    }

    return {
      months: null,
      mode: 'not-estimable',
      note: 'No hay rendimiento nominal 12M ni aporte mensual suficiente para estimar este objetivo.',
      annualRatePercent: null,
      monthlyRatePercent: null
    };
  }

  private projectWithRate(
    currentValue: number,
    targetValue: number,
    monthlyContribution: number | null,
    annualRatePercent: number | null,
    monthlyRatePercent: number,
    monthlyRate: number
  ): ProjectionEstimate {
    const contribution = monthlyContribution ?? 0;
    let projectedValue = currentValue;
    let months = 0;

    while (projectedValue < targetValue && months < PortfolioUpcomingMilestonesService.MAX_MONTHS) {
      projectedValue = projectedValue * (1 + monthlyRate) + contribution;
      months += 1;
    }

    if (projectedValue < targetValue) {
      return {
        months: null,
        mode: 'growth-and-contribution',
        note: 'No se pudo estimar el objetivo dentro del límite máximo de meses.',
        annualRatePercent,
        monthlyRatePercent
      };
    }

    return {
      months,
      mode: 'growth-and-contribution',
      note: 'La estimación usa el aporte mensual y el rendimiento nominal de los últimos 12 meses. No es una predicción, solo una proyección orientativa.',
      annualRatePercent,
      monthlyRatePercent
    };
  }

  private projectOnlyWithContributions(currentValue: number, targetValue: number, monthlyContribution: number): ProjectionEstimate {
    let projectedValue = currentValue;
    let months = 0;

    while (projectedValue < targetValue && months < PortfolioUpcomingMilestonesService.MAX_MONTHS) {
      projectedValue += monthlyContribution;
      months += 1;
    }

    if (projectedValue < targetValue) {
      return {
        months: null,
        mode: 'contribution-only',
        note: 'Proyección calculada solo con aportes por falta de rendimiento nominal 12M.',
        annualRatePercent: null,
        monthlyRatePercent: null
      };
    }

    return {
      months,
      mode: 'contribution-only',
      note: 'Proyección calculada solo con aportes por falta de rendimiento nominal 12M.',
      annualRatePercent: null,
      monthlyRatePercent: null
    };
  }

  private annualToMonthlyRatePercent(annualRatePercent: number): number {
    return (Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1) * 100;
  }

  private notAvailable(id: string, title: string, description: string, source: string): PortfolioUpcomingMilestone {
    return {
      id,
      title,
      description,
      category: id.includes('strategy')
        ? 'strategy-balance'
        : id.includes('recover')
          ? 'historical-recovery'
          : 'portfolio-value',
      status: 'not-available',
      currentValue: null,
      targetValue: null,
      remainingAmount: null,
      remainingPercent: null,
      currency: null,
      source
    };
  }

  private dateValue(value: string | Date | null | undefined): number {
    const date = value ? parseExcelDate(value) : null;
    return date ? date.getTime() : 0;
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
  }
}
