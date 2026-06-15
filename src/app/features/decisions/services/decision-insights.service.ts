import { Injectable } from '@angular/core';
import { ChartPoint } from '../../../core/services/chart-data.service';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { PortfolioCalculatorService } from '../../../core/services/portfolio-calculator.service';
import { PortfolioConcentrationService } from '../../../core/services/portfolio-concentration.service';
import { PortfolioHealthService } from '../../../core/services/portfolio-health.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { PortfolioPosition, MarketSignal } from '../../../core/models/portfolio.models';
import { CombinedAlert } from '../../../core/services/alert-mapper.service';

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

export interface DecisionSimulationResult {
  invested: string;
  projectedValue: string;
  projectedGain: string;
  horizonLabel: string;
}

export interface DecisionViewModel {
  ready: boolean;
  trafficLight: DecisionTrafficLight;
  trafficLightLabel: string;
  trafficLightReason: string;
  cards: DecisionCard[];
  actions: DecisionActionItem[];
  objectives: DecisionObjectiveItem[];
  signals: DecisionSignalItem[];
  topHoldings: ChartPoint[];
  sectorMix: ChartPoint[];
  assetTypeMix: ChartPoint[];
  simulation: DecisionSimulationResult;
}

@Injectable({ providedIn: 'root' })
export class DecisionInsightsService {
  constructor(
    private readonly calculator: PortfolioCalculatorService,
    private readonly concentration: PortfolioConcentrationService,
    private readonly healthService: PortfolioHealthService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  build(snapshot: PortfolioAppState, monthlyContribution: number, months: number, annualReturnPercent: number): DecisionViewModel {
    const positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    const concentrationReport = this.concentration.buildReport(positions, 'ALL');
    const healthReport = snapshot.dataset && snapshot.workbook ? this.healthService.buildReport(snapshot.dataset, snapshot.workbook.validation) : null;
    const summary = snapshot.summary;

    const topHoldings = [...snapshot.charts.symbolDistribution].slice(0, 10);
    const sectorMix = [...snapshot.charts.sectorDistribution].slice(0, 8);
    const assetTypeMix = [...snapshot.charts.assetTypeDistribution].slice(0, 8);

    const trafficLight = this.trafficLight(snapshot, concentrationReport, healthReport?.summary ?? null);
    const trafficLightReason = this.trafficLightReason(snapshot, concentrationReport, healthReport?.summary ?? null);

    return {
      ready: snapshot.status === 'ready' && !!snapshot.dataset,
      trafficLight: trafficLight.state,
      trafficLightLabel: trafficLight.label,
      trafficLightReason,
      cards: this.cards(snapshot, concentrationReport, healthReport?.summary ?? null),
      actions: this.actions(positions, concentrationReport, healthReport?.summary ?? null, snapshot.combinedAlerts ?? []),
      objectives: this.objectives(concentrationReport),
      signals: this.signals(snapshot.dataset?.signals ?? []),
      topHoldings,
      sectorMix,
      assetTypeMix,
      simulation: this.simulation(summary?.totalCurrentValue ?? 0, monthlyContribution, months, annualReturnPercent)
    };
  }

  private cards(snapshot: PortfolioAppState, concentrationReport: ReturnType<PortfolioConcentrationService['buildReport']>, healthSummary: ReturnType<PortfolioHealthService['buildReport']>['summary'] | null): DecisionCard[] {
    const summary = snapshot.summary;
    return [
      {
        title: 'Valor actual',
        value: this.currencyMapper.formatCurrency(summary?.totalCurrentValue ?? 0, 'ARS'),
        note: 'Suma de posiciones actuales',
        tone: 'info'
      },
      {
        title: 'Especies',
        value: this.currencyMapper.formatNumber(summary?.speciesCount ?? 0),
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
    combinedAlerts: CombinedAlert[]
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

    const worst = [...positions].sort((a, b) => (a.resultPercent ?? 0) - (b.resultPercent ?? 0))[0] ?? null;
    if (worst && (worst.resultPercent ?? 0) < -15) {
      actions.push({
        title: 'Revisar peor posición',
        note: `${worst.symbol} tiene ${this.currencyMapper.formatPercentage(worst.resultPercent ?? 0)} de resultado. Puede merecer un repaso.`,
        tone: 'warning'
      });
    }

    const best = [...positions].sort((a, b) => (b.resultPercent ?? 0) - (a.resultPercent ?? 0))[0] ?? null;
    if (best && (best.resultPercent ?? 0) > 20) {
      actions.push({
        title: 'Ganancia fuerte para vigilar',
        note: `${best.symbol} acumula ${this.currencyMapper.formatPercentage(best.resultPercent ?? 0)}. Ver si sigue alineada al plan.`,
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

  private signals(signals: MarketSignal[]): DecisionSignalItem[] {
    return [...signals]
      .sort((a, b) => this.dateValue(b.endDate) - this.dateValue(a.endDate))
      .slice(0, 8)
      .map((signal) => ({
        symbol: signal.symbol,
        signalType: signal.signalType,
        period: signal.period,
        startDate: this.formatDate(signal.startDate),
        endDate: this.formatDate(signal.endDate),
        variationPercent: this.currencyMapper.formatPercentage(signal.variationPercent ?? 0)
      }));
  }

  private simulation(currentValue: number, monthlyContribution: number, months: number, annualReturnPercent: number): DecisionSimulationResult {
    const safeMonths = Math.max(0, Math.floor(months));
    const safeContribution = Math.max(0, monthlyContribution);
    const monthlyRate = Math.max(0, annualReturnPercent) / 100 / 12;

    let projected = currentValue;
    for (let index = 0; index < safeMonths; index += 1) {
      projected = (projected + safeContribution) * (1 + monthlyRate);
    }

    const invested = currentValue + safeContribution * safeMonths;
    const gain = projected - invested;

    return {
      invested: this.currencyMapper.formatCurrency(invested, 'ARS'),
      projectedValue: this.currencyMapper.formatCurrency(projected, 'ARS'),
      projectedGain: this.currencyMapper.formatCurrency(gain, 'ARS'),
      horizonLabel: `${safeMonths} meses`
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
