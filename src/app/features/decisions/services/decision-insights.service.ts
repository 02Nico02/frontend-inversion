import { Injectable } from '@angular/core';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { PortfolioCalculatorService } from '../../../core/services/portfolio-calculator.service';
import { PortfolioConcentrationService } from '../../../core/services/portfolio-concentration.service';
import { PortfolioHealthService } from '../../../core/services/portfolio-health.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { PortfolioPosition, MarketSignal } from '../../../core/models/portfolio.models';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';
import { InvestmentMovementsPerformanceService } from '../../../core/services/investment-movements-performance.service';
import { InvestmentMovementSummary } from '../../../core/models/investment-movements.model';

export type DecisionSeverity = 'success' | 'warning' | 'critical' | 'info';
export type DecisionTrafficLight = 'green' | 'yellow' | 'red' | 'gray';

export interface DecisionCard {
  title: string;
  value: string;
  note: string;
  tone: DecisionSeverity;
}

export interface DecisionActionItem {
  title: string;
  note: string;
  tone: DecisionSeverity;
}

export interface DecisionObjectiveItem {
  label: string;
  currentPercent: number;
  targetPercent: number;
  gapPercent: number;
  tone: DecisionSeverity;
}

export interface DecisionSignalItem {
  symbol: string;
  signalType: string;
  period: string;
  startDate: string;
  endDate: string;
  variationPercent: string;
}

export interface DecisionSignalSummary {
  total30D: number;
  caidas30D: string[];
  recuperaciones30D: string[];
}

export interface DecisionSimulationResult {
  invested: string;
  projectedValue: string;
  projectedGain: string;
  horizonLabel: string;
  warning: string | null;
}

export interface DecisionViewModel {
  ready: boolean;
  trafficLight: DecisionTrafficLight;
  trafficLightLabel: string;
  trafficLightReason: string;
  currencyScope: 'ALL' | 'ARS' | 'USD';
  simulationCurrency: 'ARS' | 'USD';
  simulationInputs: {
    monthlyContribution: number;
    months: number;
    annualReturnPercent: number;
    active: boolean;
  };
  cards: DecisionCard[];
  actions: DecisionActionItem[];
  objectives: DecisionObjectiveItem[];
  signalSummary: DecisionSignalSummary;
  simulation: DecisionSimulationResult;
}

@Injectable({ providedIn: 'root' })
export class DecisionInsightsService {
  constructor(
  private readonly calculator: PortfolioCalculatorService,
  private readonly concentration: PortfolioConcentrationService,
  private readonly healthService: PortfolioHealthService,
  private readonly currencyMapper: CurrencyMapperService,
  private readonly movementsPerformance: InvestmentMovementsPerformanceService
  ) {}

  build(
    snapshot: PortfolioAppState,
    currencyScope: 'ALL' | 'ARS' | 'USD',
    simulationCurrency: 'ARS' | 'USD',
    monthlyContribution: number,
    months: number,
    annualReturnPercent: number
  ): DecisionViewModel {
    const allPositions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    const positions = currencyScope === 'ALL' ? allPositions : allPositions.filter((position) => position.currency === currencyScope);
    const simulationPositions = allPositions.filter((position) => position.currency === simulationCurrency);
    const concentrationReport = this.concentration.buildReport(positions, currencyScope);
    const healthReport = snapshot.dataset && snapshot.workbook ? this.healthService.buildReport(snapshot.dataset, snapshot.workbook.validation) : null;
    const summary = this.summaryForPositions(positions);
    const simulationSummary = this.summaryForPositions(simulationPositions);

    const trafficLight = this.trafficLight(snapshot, concentrationReport, healthReport?.summary ?? null);
    const trafficLightReason = this.trafficLightReason(snapshot, concentrationReport, healthReport?.summary ?? null);

    return {
      ready: snapshot.status === 'ready' && !!snapshot.dataset,
      trafficLight: trafficLight.state,
      trafficLightLabel: trafficLight.label,
      trafficLightReason,
      currencyScope,
      simulationCurrency,
      simulationInputs: {
        monthlyContribution,
        months,
        annualReturnPercent,
        active: monthlyContribution >= 0 && months > 0 && Number.isFinite(annualReturnPercent)
      },
      cards: this.cards(summary, currencyScope, concentrationReport, healthReport?.summary ?? null),
      actions: this.actions(positions, concentrationReport, healthReport?.summary ?? null, snapshot.combinedAlerts ?? [], this.buildMovementSummaryMap(snapshot)),
      objectives: this.objectives(concentrationReport),
      signalSummary: this.signalSummary(snapshot.dataset?.signals ?? []),
      simulation: this.simulation(simulationSummary.totalCurrentValue, simulationCurrency, monthlyContribution, months, annualReturnPercent)
    };
  }

  private summaryForPositions(positions: PortfolioPosition[]) {
    const totalCurrentValue = positions.reduce((sum, position) => sum + position.currentValue, 0);
    const totalInvested = positions.reduce((sum, position) => sum + position.totalInvested, 0);
    const totalResult = totalCurrentValue - totalInvested;
    const totalResultPercent = totalInvested > 0 ? (totalResult / totalInvested) * 100 : 0;
    const speciesCount = new Set(positions.map((position) => position.symbol)).size;
    return { totalCurrentValue, totalInvested, totalResult, totalResultPercent, speciesCount };
  }

  private cards(summary: { totalCurrentValue: number; totalInvested: number; totalResult: number; totalResultPercent: number; speciesCount: number }, currencyScope: 'ALL' | 'ARS' | 'USD', concentrationReport: ReturnType<PortfolioConcentrationService['buildReport']>, healthSummary: ReturnType<PortfolioHealthService['buildReport']>['summary'] | null): DecisionCard[] {
    const currency = currencyScope === 'ALL' ? 'ARS' : currencyScope;
    return [
      {
        title: 'Valor actual',
        value: this.currencyMapper.formatCurrency(summary.totalCurrentValue, currency),
        note: 'Suma de posiciones actuales',
        tone: 'info'
      },
      {
        title: 'Especies',
        value: this.currencyMapper.formatNumber(summary.speciesCount),
        note: 'Cantidad de tickers activos',
        tone: 'info'
      },
      {
        title: 'Top 1',
        value: this.currencyMapper.formatPercentage(concentrationReport.top1Percent),
        note: 'Concentración máxima individual',
        tone: concentrationReport.top1Percent > 25 ? 'warning' : 'success'
      },
      {
        title: 'Salud de datos',
        value: healthSummary ? `${healthSummary.criticalProblems} críticas` : 'Sin validar',
        note: healthSummary ? `${healthSummary.warnings} avisos` : 'Esperando importación',
        tone: healthSummary && healthSummary.criticalProblems > 0 ? 'critical' : healthSummary && healthSummary.warnings > 0 ? 'warning' : 'success'
      }
    ];
  }

  private actions(
    positions: PortfolioPosition[],
    concentrationReport: ReturnType<PortfolioConcentrationService['buildReport']>,
    healthSummary: ReturnType<PortfolioHealthService['buildReport']>['summary'] | null,
    combinedAlerts: CombinedAlert[],
    movementSummaryMap: Map<string, InvestmentMovementSummary>
  ): DecisionActionItem[] {
    const actions: DecisionActionItem[] = [];

    if (healthSummary?.criticalProblems) {
      actions.push({
        title: 'Revisar calidad de datos',
        note: `Hay ${healthSummary.criticalProblems} problemas críticos y ${healthSummary.warnings} advertencias.`,
        tone: 'critical'
      });
    }

    if (concentrationReport.top1Percent > 25) {
      actions.push({
        title: 'Controlar concentración',
        note: `La posición más grande concentra ${this.currencyMapper.formatPercentage(concentrationReport.top1Percent)} del portafolio.`,
        tone: 'warning'
      });
    }

    const orderedWorst = [...positions]
      .map((position) => ({ position, effective: this.effectiveResultFor(position, movementSummaryMap) }))
      .sort((a, b) => a.effective.percent - b.effective.percent);
    const worst = orderedWorst[0] ?? null;
    if (worst && worst.effective.percent < -15) {
      actions.push({
        title: 'Revisar peor posición',
        note: this.effectiveResultNote(worst.position, worst.effective, 'repasar'),
        tone: 'warning'
      });
    }

    const orderedBest = [...positions]
      .map((position) => ({ position, effective: this.effectiveResultFor(position, movementSummaryMap) }))
      .sort((a, b) => b.effective.percent - a.effective.percent);
    const best = orderedBest[0] ?? null;
    if (best && best.effective.percent > 20) {
      actions.push({
        title: 'Ganancia fuerte para vigilar',
        note: this.effectiveResultNote(best.position, best.effective, 'vigilar'),
        tone: 'info'
      });
    }

    const pendingSignals = combinedAlerts.filter((item) => item.group === 'signal').length;
    if (pendingSignals > 0) {
      actions.push({
        title: 'Señales activas disponibles',
        note: `Hay ${pendingSignals} señales cargadas para usar como referencia táctica.`,
        tone: 'success'
      });
    }

    return actions.slice(0, 4);
  }

  private buildMovementSummaryMap(snapshot: PortfolioAppState): Map<string, InvestmentMovementSummary> {
    const summaries = snapshot.dataset ? this.movementsPerformance.buildSummaryBySymbol(snapshot) : [];
    return new Map(
      summaries.map((summary) => [`${summary.symbol.toUpperCase()}__${summary.currency.toUpperCase()}`, summary] as const)
    );
  }

  private effectiveResultFor(position: PortfolioPosition, movementSummaryMap: Map<string, InvestmentMovementSummary>): { percent: number; adjusted: boolean } {
    const summary = movementSummaryMap.get(this.movementKey(position));
    if (summary?.hasAdjustments && summary.adjustedResultPercent !== null) {
      return { percent: summary.adjustedResultPercent, adjusted: true };
    }

    return { percent: position.resultPercent ?? 0, adjusted: false };
  }

  private effectiveResultNote(
    position: PortfolioPosition,
    effective: { percent: number; adjusted: boolean },
    mode: 'repasar' | 'vigilar'
  ): string {
    const percent = this.currencyMapper.formatPercentage(effective.percent);
    if (effective.adjusted) {
      return `${position.symbol} tiene resultado ajustado por movimientos de inversión: ${percent}. Revisar si querés auditar la posición, no por pérdida nominal simple.`;
    }

    if (mode === 'vigilar') {
      return `${position.symbol} acumula ${percent}. Ver si sigue alineada al plan.`;
    }

    return `${position.symbol} tiene ${percent} de resultado. Puede merecer un repaso.`;
  }

  private movementKey(position: PortfolioPosition): string {
    return `${position.symbol.toUpperCase()}__${String(position.currency ?? 'UNKNOWN').toUpperCase()}`;
  }

  private objectives(concentrationReport: ReturnType<PortfolioConcentrationService['buildReport']>): DecisionObjectiveItem[] {
    const references = [
      { label: 'Top 1', target: 20, current: concentrationReport.top1Percent },
      { label: 'Top 3', target: 45, current: concentrationReport.top3Percent },
      { label: 'Top 5', target: 60, current: concentrationReport.top5Percent },
      { label: 'Top 10', target: 80, current: concentrationReport.top10Percent }
    ];

    return references.map((item) => ({
      label: item.label,
      currentPercent: item.current,
      targetPercent: item.target,
      gapPercent: item.current - item.target,
      tone: item.current <= item.target ? 'success' : item.current <= item.target + 10 ? 'warning' : 'critical'
    }));
  }

  private signalSummary(signals: MarketSignal[]): DecisionSignalSummary {
    const ordered30D = [...signals]
      .filter((signal) => String(signal.period).toUpperCase() === '30D')
      .sort((a, b) => this.dateValue(b.endDate) - this.dateValue(a.endDate));
    const uniqueByType = (type: 'caida' | 'recuperacion') => Array.from(new Set(
      ordered30D
        .filter((signal) => String(signal.signalType).toLowerCase() === type)
        .map((signal) => signal.symbol.toUpperCase())
    ));

    return {
      total30D: ordered30D.length,
      caidas30D: uniqueByType('caida').slice(0, 6),
      recuperaciones30D: uniqueByType('recuperacion').slice(0, 6)
    };
  }

  private simulation(currentValue: number, currency: 'ARS' | 'USD', monthlyContribution: number, months: number, annualReturnPercent: number): DecisionSimulationResult {
    const safeMonths = Math.max(0, Math.floor(months));
    const safeContribution = Math.max(0, monthlyContribution);
    const monthlyRate = annualReturnPercent / 100 / 12;

    let projected = currentValue;
    for (let index = 0; index < safeMonths; index += 1) {
      projected = (projected + safeContribution) * (1 + monthlyRate);
    }

    const invested = currentValue + safeContribution * safeMonths;
    const gain = projected - invested;
    const warning = annualReturnPercent < 0
      ? 'Tasa negativa: escenario defensivo, no una predicción.'
      : null;

    return {
      invested: this.currencyMapper.formatCurrency(invested, currency),
      projectedValue: this.currencyMapper.formatCurrency(projected, currency),
      projectedGain: this.currencyMapper.formatCurrency(gain, currency),
      horizonLabel: `${safeMonths} meses`,
      warning
    };
  }

  private trafficLight(
    snapshot: PortfolioAppState,
    concentrationReport: ReturnType<PortfolioConcentrationService['buildReport']>,
    healthSummary: ReturnType<PortfolioHealthService['buildReport']>['summary'] | null
  ): { state: DecisionTrafficLight; label: string } {
    if (snapshot.status !== 'ready' || !snapshot.dataset) {
      return { state: 'gray', label: 'Esperando importación' };
    }
    if (healthSummary?.criticalProblems) {
      return { state: 'red', label: 'Requiere revisión' };
    }
    if ((healthSummary?.warnings ?? 0) > 0 || concentrationReport.top1Percent > 25 || concentrationReport.currencyWarning) {
      return { state: 'yellow', label: 'En observación' };
    }
    return { state: 'green', label: 'Saludable' };
  }

  private trafficLightReason(
    snapshot: PortfolioAppState,
    concentrationReport: ReturnType<PortfolioConcentrationService['buildReport']>,
    healthSummary: ReturnType<PortfolioHealthService['buildReport']>['summary'] | null
  ): string {
    if (snapshot.status !== 'ready' || !snapshot.dataset) {
      return 'Importá el Excel para habilitar el panel de decisiones.';
    }
    if (healthSummary?.criticalProblems) {
      return `Hay ${healthSummary.criticalProblems} problemas críticos de datos para resolver antes de decidir.`;
    }
    if (concentrationReport.currencyWarning) {
      return concentrationReport.currencyWarning;
    }
    if (concentrationReport.top1Percent > 25) {
      return `La posición más grande concentra ${this.currencyMapper.formatPercentage(concentrationReport.top1Percent)}; conviene vigilar el riesgo.`;
    }
    if ((healthSummary?.warnings ?? 0) > 0) {
      return `Hay ${healthSummary?.warnings ?? 0} advertencias de salud para revisar.`;
    }
    return 'No aparecen alertas críticas en los datos cargados.';
  }

  private formatDate(value: string | Date | null | undefined): string {
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

  private dateValue(value: string | Date | null | undefined): number {
    if (!value) {
      return 0;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
