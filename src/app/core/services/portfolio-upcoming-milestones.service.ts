import { Injectable } from '@angular/core';
import { PortfolioUpcomingMilestone, PortfolioUpcomingMilestoneBreakdown } from '../models/portfolio-upcoming-milestone.model';
import { PortfolioAppState } from './portfolio-state.service';
import { parseExcelDate } from '../utils/value-parsing.utils';

const MANUAL_GOALS_ARS = [10_000_000, 15_000_000, 20_000_000];

interface StrategyBucket {
  retirementAmountARS: number;
  savingsAmountARS: number;
  retirementAmountUSD: number;
  savingsAmountUSD: number;
}

@Injectable({ providedIn: 'root' })
export class PortfolioUpcomingMilestonesService {
  buildUpcomingMilestones(snapshot: PortfolioAppState, monthlyContributionArs: number | null): PortfolioUpcomingMilestone[] {
    const goals: PortfolioUpcomingMilestone[] = [];

    const nextMillion = this.buildNextMillionGoal(snapshot, monthlyContributionArs);
    if (nextMillion) {
      goals.push(nextMillion);
    }

    const historicalRecovery = this.buildHistoricalRecoveryGoal(snapshot, monthlyContributionArs);
    if (historicalRecovery) {
      goals.push(historicalRecovery);
    }

    const strategyBalance = this.buildStrategyGuidanceGoal(snapshot);
    if (strategyBalance) {
      goals.push(strategyBalance);
    }

    const manualGoal = this.buildManualGoal(snapshot, monthlyContributionArs);
    if (manualGoal && !goals.some((goal) => goal.currency === manualGoal.currency && goal.targetValue === manualGoal.targetValue)) {
      goals.push(manualGoal);
    }

    return goals;
  }

  private buildNextMillionGoal(snapshot: PortfolioAppState, monthlyContributionArs: number | null): PortfolioUpcomingMilestone | null {
    const currentValue = this.currentArsValue(snapshot);
    if (currentValue === null || currentValue < 0) {
      return this.notAvailable(
        'next-million-ars',
        'Próximo millón ARS',
        'No hay valor actual en ARS suficiente para calcular el próximo millón.',
        'portfolio-value'
      );
    }

    const million = 1_000_000;
    const targetValue = Math.floor(currentValue / million) * million + million;
    const remainingAmount = Math.max(0, targetValue - currentValue);
    const estimatedMonths = this.estimatedMonths(remainingAmount, monthlyContributionArs);

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
      estimatedMonths,
      source: 'PortfolioSummary.totalCurrentValue ARS'
    };
  }

  private buildHistoricalRecoveryGoal(snapshot: PortfolioAppState, monthlyContributionArs: number | null): PortfolioUpcomingMilestone | null {
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
    const estimatedMonths = this.estimatedMonths(remainingAmount, monthlyContributionArs);

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
      estimatedMonths,
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
      breakdown,
      source: 'Tabla35'
    };
  }

  private buildManualGoal(snapshot: PortfolioAppState, monthlyContributionArs: number | null): PortfolioUpcomingMilestone | null {
    const currentValue = this.currentArsValue(snapshot);
    if (currentValue === null) {
      return null;
    }

    const targetValue = MANUAL_GOALS_ARS.find((goal) => goal > currentValue) ?? null;
    if (!targetValue) {
      return null;
    }

    const remainingAmount = targetValue - currentValue;
    const estimatedMonths = this.estimatedMonths(remainingAmount, monthlyContributionArs);

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
      estimatedMonths,
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
      currentPercent: retirementPercent,
      targetPercent: savingsPercent,
      gapPercent: retirementPercent - savingsPercent,
      retirementPercent,
      savingsPercent,
      retirementAmount,
      savingsAmount,
      currentAmount: retirementAmount,
      targetAmount: savingsAmount,
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

  private estimatedMonths(remainingAmount: number, monthlyContribution: number | null): number | null {
    if (remainingAmount <= 0 || monthlyContribution === null || !Number.isFinite(monthlyContribution) || monthlyContribution <= 0) {
      return null;
    }
    return Math.ceil(remainingAmount / monthlyContribution);
  }

  private notAvailable(
    id: string,
    title: string,
    description: string,
    source: string
  ): PortfolioUpcomingMilestone {
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
