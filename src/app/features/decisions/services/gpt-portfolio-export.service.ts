import { Injectable } from '@angular/core';
import { PortfolioCalculatorService } from '../../../core/services/portfolio-calculator.service';
import { PortfolioHealthService } from '../../../core/services/portfolio-health.service';
import { InvestmentMovementsPerformanceService } from '../../../core/services/investment-movements-performance.service';
import { EffectivePortfolioPosition, PositionEffectiveMetricsService } from '../../../core/services/position-effective-metrics.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../../core/services/privacy-mode.service';
import { parseExcelDate } from '../../../core/utils/value-parsing.utils';
import { MovementDateRange, MovementDateRangeService } from './movement-date-range.service';
import { DecisionOpportunitiesService, DecisionOpportunitiesViewModel } from './decision-opportunities.service';
import {
  AnnualInvestmentSummary,
  DailyBalance,
  InvestmentOperation,
  InvestmentSale,
  MarketSignal,
  MonthlyInvestmentSummary,
  PortfolioPosition,
  StrategicSplit
} from '../../../core/models/portfolio.models';
import { DecisionViewModel } from './decision-insights.service';

export type ExportFormat = 'markdown' | 'json' | 'both';
export type ExportCurrencyScope = 'ALL' | 'ARS' | 'USD';
export type ExportSimulationCurrency = 'ARS' | 'USD';
export type ExportMode = 'summary' | 'full';

export interface GptPortfolioExportOptions {
  format: ExportFormat;
  mode: ExportMode;
  includeFullPurchases: boolean;
  includeMonthlyHistory: boolean;
  includeSignals: boolean;
  includeDataReview: boolean;
  includeSimulation: boolean;
  maskSensitive: boolean;
  currencyScope: ExportCurrencyScope;
  simulationCurrency: ExportSimulationCurrency;
  movementDateRange: MovementDateRange;
  manualContext: WeeklyManualContext;
}

export interface WeeklyManualContext {
  cashArs: number | null;
  cashUsd: number | null;
}

type TableRow = Record<string, any>;

interface ExportSummaryScope {
  currency: 'ALL' | 'ARS' | 'USD' | null;
  totalCurrentValue: string;
  totalInvested: string;
  totalResult: string;
  totalResultPercent: string;
  speciesCount: number;
  positionsCount: number;
  bestPosition: ExportPositionDigest | null;
  worstPosition: ExportPositionDigest | null;
}

interface ExportPositionDigest {
  symbol: string;
  currency: string;
  assetType: string;
  sector: string;
  region: string;
  currentValue: string;
  resultPercent: string;
  resultBasis?: string | null;
  note?: string | null;
}

interface LatestBalanceDigest {
  currentValue: string | null;
  currentDate: string | null;
  previousValue: string | null;
  previousDate: string | null;
  delta: string | null;
  deltaPercent: string | null;
  bestValue: string | null;
  bestDate: string | null;
  worstValue: string | null;
  worstDate: string | null;
}

interface ExportPositionRow {
  especie: string;
  moneda: string;
  tipoActivo: string;
  sector: string;
  subsector: string;
  region: string;
  cantidad: string;
  precioPromedio: string;
  precioActual: string;
  totalInvertido: string;
  totalActual: string;
  resultadoNominalMonto: string;
  resultadoNominalPercent: string;
  resultadoEfectivoMonto: string;
  resultadoEfectivoPercent: string;
  resultadoMonto: string;
  resultadoPercent: string;
  valorComparable: string;
  minimoEsperado: string;
  vsMinimo: string;
  percentVsMinimo: string;
  estadoBenchmark: string;
  pesoPercent: string;
  alertas: string;
  estadoSemaforo: string;
  motivoSemaforo: string;
}

interface ExportAlertRow {
  especie: string;
  condicion?: string;
  tipoAlerta?: string;
  precioActual: string;
  precioObjetivo?: string;
  objetivo?: string;
  distanciaNumerica?: number | null;
  distanciaPercent: string;
  estadoCalculado?: string;
  estadoOriginal?: string;
  observacion: string;
  notas?: string;
  fecha?: string;
  alerta?: string;
}

interface ExportSignalRow {
  especie: string;
  tipoSenal: string;
  periodo: string;
  fechaInicio: string;
  precioInicio: string;
  fechaFin: string;
  precioFin: string;
  variacionPercent: string;
  observacion: string;
}

interface ExportConcentrationBucket {
  label: string;
  weightPercent: number;
  top3Labels: string[];
  categoryCount: number;
}

interface ExportConcentration {
  currencyScope: ExportCurrencyScope;
  totalCurrentValue: number;
  top1Percent: number;
  top3Percent: number;
  top5Percent: number;
  top10Percent: number;
  largestPosition: ExportPositionDigest | null;
  largestSector: ExportConcentrationBucket | null;
  largestSubsector: ExportConcentrationBucket | null;
  largestRegion: ExportConcentrationBucket | null;
  largestAssetType: ExportConcentrationBucket | null;
  ranking: Array<{
    rank: number;
    symbol: string;
    currency: string;
    assetType: string;
    sector: string;
    subsector: string;
    region: string;
    totalCurrentValue: string;
    weightPercent: number;
    cumulativeWeightPercent: number;
  }>;
  dimensionSummaries: Array<{
    dimension: string;
    label: string;
    weightPercent: number;
    top3Labels: string[];
    categoryCount: number;
  }>;
  currencyWarning: string | null;
}

interface ExportSimulation {
  moneda: ExportSimulationCurrency;
  aporteMensual: string;
  meses: number;
  rendimientoAnualEsperadoPercent: string;
  valorProyectado: string;
  gananciaEstimada: string;
  aclaracion: string;
}

interface ExportDataReviewItem {
  severidad: string;
  fuente: string;
  especie: string;
  problema: string;
  sugerencia: string;
}

interface ExportMovementAdjustmentRow {
  especie: string;
  moneda: string;
  rentasCobradas: string;
  amortizacionesCobradas: string;
  resultadoSinAjuste: string;
  resultadoAjustado: string;
  resultadoAjustadoPercent: string;
  nota: string;
}

interface ExportBenchmarkMinimum {
  summary: {
    balanceVsMinimumArs: string | null;
    balanceVsMinimumPercentArs: string | null;
    currentComparableArs: string | null;
    minimumExpectedArs: string | null;
    comparableLotsCount: number;
    status: string;
    description: string;
  } | null;
  totalBelowMinimum: number;
  positionsBelowMinimumShown: number;
  positionsBelowMinimum: Array<{
    especie: string;
    moneda: string;
    vsMinimo: string;
    percentVsMinimo: string;
    motivo: string;
  }>;
}

interface ExportPendingOrders {
  description: string;
  cashTreatment: 'reserved_not_available_cash';
  includedInCurrentPositions: false;
  includedInAvailableCash: false;
  totalOrders: number;
  totalReservedARS: number;
  orders: Array<{
    symbol: string;
    quantity: number;
    limitPriceARS: number;
    reservedAmountARS: number;
  }>;
  summaryBySymbol: Array<{
    symbol: string;
    totalQuantity: number;
    totalReservedARS: number;
    averageLimitPriceARS: number;
    ordersCount: number;
  }>;
  gptInstruction: string;
}

interface ExportRecentMovementCurrencySummary {
  currency: 'ALL' | 'ARS' | 'USD';
  purchasesGross: string;
  salesGross: string;
  operatingFlow: string;
  purchaseCount: number;
  saleCount: number;
}

interface ExportRecentMovementRow {
  symbol: string;
  currency: string;
  date: string;
  quantity: string;
  amount: string;
  note: string;
}

interface ExportRecentMovements {
  movementDateRange: MovementDateRange;
  rangeLabel: string;
  rangePresetLabel: string;
  referenceDate: string;
  startDate: string;
  manualContext: WeeklyManualContext;
  summaryByCurrency: ExportRecentMovementCurrencySummary[];
  newPositions: Array<{
    symbol: string;
    currency: string;
    firstPurchaseDate: string;
    purchasesInPeriod: number;
    purchasesGross: string;
    note: string;
  }>;
  closedPositions: Array<{
    symbol: string;
    currency: string;
    saleDate: string;
    buyDate: string;
    note: string;
  }>;
  recentPurchases: ExportRecentMovementRow[];
  recentSales: ExportRecentMovementRow[];
}

interface GptPortfolioExport {
  metadata: {
    generatedAt: string;
    sourceFile: string | null;
    workbookStatus: string;
    tablesDetected: string[];
    warnings: string[];
    errors: string[];
    privacyModeActive: boolean;
    masked: boolean;
    currencyScope: ExportCurrencyScope;
    simulationCurrency: ExportSimulationCurrency;
    exportMode: ExportMode;
  };
  instructions: string[];
  summary: {
    general: ExportSummaryScope;
    ars: ExportSummaryScope;
    usd: ExportSummaryScope;
    latestBalance: LatestBalanceDigest;
    warning: string;
  };
  opportunities: DecisionOpportunitiesViewModel;
  positions: ExportPositionRow[];
  operationsBySymbol: Record<string, TableRow[]>;
  alerts: {
    manual: ExportAlertRow[];
    calculated: ExportAlertRow[];
    signals5D: ExportSignalRow[];
    signals30D: ExportSignalRow[];
    excludedSignals: Array<{ especie: string; motivo: string }>;
  };
  recentMovements: ExportRecentMovements;
  concentration: ExportConcentration;
  distributions: {
    moneda: Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies: number }>;
    tipoActivo: Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies: number }>;
    sector: Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies: number }>;
    subsector: Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies: number }>;
    region: Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies: number }>;
    especiesTop10: Array<{ categoria: string; monto: string; pesoPercent: string }>;
  };
  decisionInsights: {
    semaforo: string;
    motivo: string;
    acciones: Array<{ title: string; note: string; tone: string }>;
    saludDatos: { criticalProblems: number; warnings: number; status: string };
    referenciasConcentracion: Array<{ label: string; currentPercent: number; targetPercent: number; gapPercent: number }>;
    senalesActivas: Array<{ symbol: string; signalType: string; period: string }>;
    peorPosicion: ExportPositionDigest | null;
    mejorPosicion: ExportPositionDigest | null;
    mayorConcentracion: string;
    advertenciasImportantes: string[];
  };
  dataReview: ExportDataReviewItem[];
  monthlySummary: Array<TableRow>;
  annualSummary: Array<TableRow>;
  strategicSplit: {
    fecha: string;
    jubilacionPercent: string | null;
    ahorroPercent: string | null;
    desvioPercent: string | null;
    montoJubilacionARS: string | null;
    montoAhorroARS: string | null;
    montoJubilacionUSD: string | null;
    montoAhorroUSD: string | null;
    warning: string | null;
  } | null;
  benchmarkMinimum: ExportBenchmarkMinimum;
  pendingOrders: ExportPendingOrders;
  movementAdjustments: ExportMovementAdjustmentRow[];
  simulation: ExportSimulation | null;
}

interface BuildResult {
  markdown?: string;
  json?: string;
  exportData: GptPortfolioExport;
}

@Injectable({ providedIn: 'root' })
export class GptPortfolioExportService {
  constructor(
    private readonly calculator: PortfolioCalculatorService,
    private readonly healthService: PortfolioHealthService,
    private readonly movementsPerformance: InvestmentMovementsPerformanceService,
    private readonly effectiveMetrics: PositionEffectiveMetricsService,
    private readonly opportunities: DecisionOpportunitiesService,
    private readonly privacyMode: PrivacyModeService,
    private readonly movementDateRangeService: MovementDateRangeService
  ) {}

  buildExport(snapshot: PortfolioAppState, viewModel: DecisionViewModel, options: GptPortfolioExportOptions): BuildResult {
    const exportData = this.buildData(snapshot, viewModel, options);
    return {
      exportData,
      markdown: options.format === 'json' ? undefined : this.renderMarkdown(exportData, options),
      json: options.format === 'markdown' ? undefined : JSON.stringify(exportData, null, 2)
    };
  }

  buildClipboardSummary(snapshot: PortfolioAppState, viewModel: DecisionViewModel, options: GptPortfolioExportOptions): string {
    const data = this.buildData(snapshot, viewModel, {
      ...options,
      mode: 'summary',
      includeFullPurchases: false,
      includeMonthlyHistory: false,
      includeSignals: false,
      includeDataReview: false,
      includeSimulation: false
    });

    return [
      'Contexto semanal de portafolio',
      `- Fecha: ${data.metadata.generatedAt}`,
      `- Balance vs minimo ARS: ${data.benchmarkMinimum.summary?.balanceVsMinimumArs ?? 'N/D'}`,
      `- Órdenes pendientes: ${data.pendingOrders.totalOrders} / ${data.pendingOrders.totalReservedARS}`,
      `- Alertas activadas: ${this.activatedAlertSymbols(data).join(', ') || 'N/D'}`,
      `- Semaforo: ${data.decisionInsights.semaforo}`,
      `- Peor posicion: ${data.decisionInsights.peorPosicion?.symbol ?? 'N/D'}`,
      `- Mejor posicion: ${data.decisionInsights.mejorPosicion?.symbol ?? 'N/D'}`
    ].join('\n');
  }

  private buildData(snapshot: PortfolioAppState, viewModel: DecisionViewModel, options: GptPortfolioExportOptions): GptPortfolioExport {
    const positions = snapshot.dataset?.positions ?? [];
    const enrichedPositions = snapshot.dataset ? this.calculator.enrichPositions(positions, snapshot.dataset.classifications) : [];
    const movementSummaries = snapshot.dataset ? this.movementsPerformance.buildSummaryBySymbol(snapshot) : [];
    const movementSummaryBySymbol = new Map(
      movementSummaries.map((summary) => [`${summary.symbol.toUpperCase()}__${summary.currency.toUpperCase()}`, summary] as const)
    );
    const effectivePositionMap = this.effectiveMetrics.buildEffectivePositionMap(snapshot);
    const totalPortfolioValue = enrichedPositions.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
    const healthReport = snapshot.dataset && snapshot.workbook ? this.healthService.buildReport(snapshot.dataset, snapshot.workbook.validation) : null;
    const latestBalance = this.computeLatestBalance(snapshot.dataset?.dailyBalances ?? []);
    const summary = this.buildSummary(enrichedPositions, latestBalance, movementSummaryBySymbol);
    const alertIndex = this.buildAlertIndex(snapshot, enrichedPositions);
    const alerts = this.buildAlerts(snapshot, enrichedPositions, alertIndex);
    const concentration = this.buildConcentration(enrichedPositions, options.currencyScope);
    const distributions = this.buildDistributions(enrichedPositions, options.currencyScope);
    const monthlySummary = this.buildMonthlySummary(snapshot.dataset?.monthlySummary ?? [], options);
    const annualSummary = this.buildAnnualSummary(snapshot.dataset?.annualSummary ?? []);
    const strategicSplit = this.buildStrategicSplit(snapshot.dataset?.strategicSplit ?? [], totalPortfolioValue);
    const simulation = this.buildSimulation(viewModel, options);
    const opportunities = this.opportunities.build(snapshot);
    const benchmarkMinimum = this.buildBenchmarkMinimum(opportunities);
    const pendingOrders = this.buildPendingOrders(snapshot);
    const movementAdjustments = this.buildMovementAdjustments(movementSummaries);
    const decisionInsights = this.buildDecisionInsights(viewModel, enrichedPositions, concentration, alerts, movementSummaryBySymbol);
    const dataReview = this.buildDataReview(viewModel, healthReport?.findings ?? [], alerts, strategicSplit, monthlySummary, simulation, snapshot, options);
    const operationsBySymbol = this.buildOperationsBySymbol(snapshot.dataset?.operations ?? [], enrichedPositions, options);
    const recentMovements = this.buildRecentMovements(snapshot, options);

    return {
      metadata: {
        generatedAt: this.formatDateTime(new Date()),
        sourceFile: snapshot.fileName,
        workbookStatus: snapshot.status,
        tablesDetected: snapshot.workbook?.validation.detectedTables.map((table) => table.displayName || table.name) ?? [],
        warnings: snapshot.validationWarnings ?? [],
        errors: snapshot.validationErrors ?? [],
        privacyModeActive: this.privacyMode.enabled,
        masked: options.maskSensitive,
        currencyScope: options.currencyScope,
        simulationCurrency: options.simulationCurrency,
        exportMode: options.mode
      },
      instructions: [],
      summary,
      opportunities,
      positions: this.buildPositions(enrichedPositions, options, alertIndex, effectivePositionMap),
      operationsBySymbol,
      alerts,
      recentMovements,
      concentration,
      distributions,
      decisionInsights,
      dataReview,
      monthlySummary,
      annualSummary,
      strategicSplit,
      benchmarkMinimum,
      pendingOrders,
      movementAdjustments,
      simulation
    };
  }

  private buildSummary(
    positions: PortfolioPosition[],
    latestBalance: LatestBalanceDigest,
    movementSummaryBySymbol: Map<string, { adjustedResultPercent: number | null; hasAdjustments: boolean; adjustedResultAmount: number | null }>
  ): GptPortfolioExport['summary'] {
    return {
      general: this.summaryForScope(positions, 'ALL', movementSummaryBySymbol),
      ars: this.summaryForScope(positions, 'ARS', movementSummaryBySymbol),
      usd: this.summaryForScope(positions, 'USD', movementSummaryBySymbol),
      latestBalance,
      warning: 'Este total mezcla ARS y USD sin convertir. Usar solo como referencia visual.'
    };
  }

  private summaryForScope(
    positions: PortfolioPosition[],
    scope: ExportCurrencyScope,
    movementSummaryBySymbol: Map<string, { adjustedResultPercent: number | null; hasAdjustments: boolean; adjustedResultAmount: number | null }>
  ): ExportSummaryScope {
    const filtered = scope === 'ALL'
      ? positions
      : positions.filter((position) => this.normalizeCurrency(position.currency) === scope);

    const totalCurrentValue = filtered.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
    const totalInvested = filtered.reduce((sum, position) => sum + (position.totalInvested ?? 0), 0);
    const totalResult = totalCurrentValue - totalInvested;
    const totalResultPercent = totalInvested > 0 ? (totalResult / totalInvested) * 100 : null;
    const speciesCount = new Set(filtered.map((position) => position.symbol)).size;
    const formattedCurrency = scope === 'ALL' ? 'ARS' : scope;
    const resultScore = (position: PortfolioPosition) => this.exportResultPercent(position, movementSummaryBySymbol);
    const bestPosition = [...filtered].sort((a, b) => resultScore(b) - resultScore(a))[0] ?? null;
    const worstPosition = [...filtered].sort((a, b) => resultScore(a) - resultScore(b))[0] ?? null;

    return {
      currency: scope === 'ALL' ? null : scope,
      totalCurrentValue: filtered.length ? this.formatMoney(totalCurrentValue, formattedCurrency) : 'N/D',
      totalInvested: filtered.length ? this.formatMoney(totalInvested, formattedCurrency) : 'N/D',
      totalResult: filtered.length ? this.formatMoney(totalResult, formattedCurrency) : 'N/D',
      totalResultPercent: filtered.length ? this.formatPercent(totalResultPercent) : 'N/D',
      speciesCount,
      positionsCount: filtered.length,
      bestPosition: bestPosition ? this.digestPosition(bestPosition, movementSummaryBySymbol) : null,
      worstPosition: worstPosition ? this.digestPosition(worstPosition, movementSummaryBySymbol) : null
    };
  }

  private digestPosition(
    position: PortfolioPosition,
    movementSummaryBySymbol: Map<string, { adjustedResultPercent: number | null; hasAdjustments: boolean; adjustedResultAmount: number | null }> = new Map()
  ): ExportPositionDigest {
    const movementSummary = movementSummaryBySymbol.get(`${position.symbol.toUpperCase()}__${this.normalizeCurrency(position.currency)}`) ?? null;
    const adjustedResultPercent = movementSummary?.adjustedResultPercent;
    const hasAdjustments = Boolean(movementSummary?.hasAdjustments);
    return {
      symbol: position.symbol,
      currency: this.normalizeCurrency(position.currency),
      assetType: position.assetType ?? position.positionType ?? 'N/D',
      sector: position.sector ?? 'N/D',
      region: position.region ?? 'N/D',
      currentValue: this.formatMoney(position.currentValue, position.currency),
      resultPercent: this.formatPercent(adjustedResultPercent ?? position.resultPercent),
      resultBasis: hasAdjustments ? 'adjusted' : 'nominal',
      note: hasAdjustments ? 'Resultado ajustado por movimientos de inversión' : null
    };
  }

  private exportResultPercent(
    position: PortfolioPosition,
    movementSummaryBySymbol: Map<string, { adjustedResultPercent: number | null; hasAdjustments: boolean; adjustedResultAmount: number | null }> = new Map()
  ): number {
    const movementSummary = movementSummaryBySymbol.get(`${position.symbol.toUpperCase()}__${this.normalizeCurrency(position.currency)}`) ?? null;
    if (movementSummary?.hasAdjustments && movementSummary.adjustedResultPercent !== null) {
      return movementSummary.adjustedResultPercent;
    }
    return position.resultPercent ?? 0;
  }

  private computeLatestBalance(balances: DailyBalance[]): LatestBalanceDigest {
    const ordered = [...balances]
      .filter((item) => item.balance !== null && item.balance !== undefined)
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));

    if (!ordered.length) {
      return {
        currentValue: null,
        currentDate: null,
        previousValue: null,
        previousDate: null,
        delta: null,
        deltaPercent: null,
        bestValue: null,
        bestDate: null,
        worstValue: null,
        worstDate: null
      };
    }

    const current = ordered[ordered.length - 1];
    const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;
    const best = [...ordered].sort((a, b) => Number(b.balance ?? 0) - Number(a.balance ?? 0))[0];
    const worst = [...ordered].sort((a, b) => Number(a.balance ?? 0) - Number(b.balance ?? 0))[0];
    const currentValue = Number(current.balance ?? 0);
    const previousValue = previous ? Number(previous.balance ?? 0) : null;
    const delta = previousValue !== null ? currentValue - previousValue : null;
    const deltaPercent = previousValue !== null && previousValue !== 0 ? (delta! / previousValue) * 100 : null;

    return {
      currentValue: this.formatMoney(currentValue, 'ARS'),
      currentDate: this.formatDate(current.date),
      previousValue: previousValue === null ? null : this.formatMoney(previousValue, 'ARS'),
      previousDate: previous ? this.formatDate(previous.date) : null,
      delta: delta === null ? null : this.formatMoney(delta, 'ARS'),
      deltaPercent: deltaPercent === null ? null : this.formatPercent(deltaPercent),
      bestValue: this.formatMoney(Number(best.balance ?? 0), 'ARS'),
      bestDate: this.formatDate(best.date),
      worstValue: this.formatMoney(Number(worst.balance ?? 0), 'ARS'),
      worstDate: this.formatDate(worst.date)
    };
  }

  private buildAlertIndex(
    snapshot: PortfolioAppState,
    positions: PortfolioPosition[]
  ): Map<string, { count: number; nearestDistance: number | null; nearestStatus: string; nearestNote: string | null; hasSuspiciousScale: boolean }> {
    const currentBySymbol = new Map(positions.map((position) => [position.symbol.toUpperCase(), position]));
    const index = new Map<string, { count: number; nearestDistance: number | null; nearestStatus: string; nearestNote: string | null; hasSuspiciousScale: boolean }>();

    for (const alert of snapshot.dataset?.manualAlerts ?? []) {
      const symbol = alert.symbol.toUpperCase();
      const current = currentBySymbol.get(symbol) ?? null;
      const distance = this.distancePercent(alert.targetPrice, current?.currentPrice ?? null);
      const status = this.manualStatus(alert.condition, alert.targetPrice, current?.currentPrice, alert.status);
      const bucket = index.get(symbol) ?? {
        count: 0,
        nearestDistance: null,
        nearestStatus: status,
        nearestNote: null,
        hasSuspiciousScale: false
      };

      bucket.count += 1;
      if (distance !== null && (bucket.nearestDistance === null || Math.abs(distance) < Math.abs(bucket.nearestDistance))) {
        bucket.nearestDistance = distance;
        bucket.nearestStatus = status;
        bucket.nearestNote = alert.notes ?? null;
      }
      if (distance !== null && Math.abs(distance) > 80) {
        bucket.hasSuspiciousScale = true;
      }
      index.set(symbol, bucket);
    }

    return index;
  }

  private buildPositions(
    positions: PortfolioPosition[],
    options: GptPortfolioExportOptions,
    alertIndex: Map<string, { count: number; nearestDistance: number | null; nearestStatus: string; nearestNote: string | null; hasSuspiciousScale: boolean }>,
    effectivePositionMap: Map<string, EffectivePortfolioPosition>
  ): ExportPositionRow[] {
    const ordered = [...positions].sort((a, b) => {
      const currencyOrder = this.normalizeCurrency(a.currency).localeCompare(this.normalizeCurrency(b.currency));
      if (currencyOrder !== 0) return currencyOrder;
      return (b.portfolioWeight ?? 0) - (a.portfolioWeight ?? 0);
    });

    return ordered.map((position) => {
      const alert = alertIndex.get(position.symbol.toUpperCase()) ?? null;
      const effective = effectivePositionMap.get(this.positionEffectiveKey(position.symbol, position.currency)) ?? null;
      const minimum = effective?.minimumPerformance ?? null;
      const benchmarkAvailable = Boolean(
        minimum &&
        minimum.minimumExpectedValue !== null &&
        minimum.valueVsMinimumAmount !== null &&
        minimum.valueVsMinimumPercent !== null
      );
      const benchmarkState = !minimum || !benchmarkAvailable
        ? 'SIN_BENCHMARK'
        : (minimum.valueVsMinimumAmount ?? 0) < 0
          ? 'BAJO_MINIMO'
          : 'SOBRE_MINIMO';
      const status = this.positionStatus(position, alert, effective);
      const alertLabel = alert && alert.count > 0
        ? `${alert.count} alertas · ${alert.nearestNote ? `próxima: ${alert.nearestNote}` : 'sin nota'} · ${alert.nearestStatus}`
        : 'Sin alertas';
      return {
        especie: position.symbol,
        moneda: this.normalizeCurrency(position.currency),
        tipoActivo: position.assetType ?? position.positionType ?? 'N/D',
        sector: position.sector ?? 'N/D',
        subsector: position.subsector ?? 'N/D',
        region: position.region ?? 'N/D',
        cantidad: this.maskOrFormatNumber(position.quantity, options, 4),
        precioPromedio: this.maskOrFormatMoney(position.averagePrice, position.currency, options),
        precioActual: this.maskOrFormatMoney(position.currentPrice, position.currency, options),
        totalInvertido: this.maskOrFormatMoney(position.totalInvested, position.currency, options),
        totalActual: this.maskOrFormatMoney(position.currentValue, position.currency, options),
        resultadoNominalMonto: this.maskOrFormatMoney(position.resultAmount, position.currency, options),
        resultadoNominalPercent: this.maskOrFormatPercent(position.resultPercent, options),
        resultadoEfectivoMonto: this.maskOrFormatMoney(effective?.effectiveResultAmount ?? position.resultAmount, position.currency, options),
        resultadoEfectivoPercent: this.maskOrFormatPercent(effective?.effectiveResultPercent ?? position.resultPercent, options),
        resultadoMonto: this.maskOrFormatMoney(effective?.effectiveResultAmount ?? position.resultAmount, position.currency, options),
        resultadoPercent: this.maskOrFormatPercent(effective?.effectiveResultPercent ?? position.resultPercent, options),
        valorComparable: this.maskOrFormatMoney(minimum?.comparableValue ?? null, position.currency, options),
        minimoEsperado: this.maskOrFormatMoney(minimum?.minimumExpectedValue ?? null, position.currency, options),
        vsMinimo: this.maskOrFormatMoney(minimum?.valueVsMinimumAmount ?? null, position.currency, options),
        percentVsMinimo: this.maskOrFormatPercent(minimum?.valueVsMinimumPercent ?? null, options),
        estadoBenchmark: benchmarkState,
        pesoPercent: this.maskOrFormatPercent(position.portfolioWeight, options),
        alertas: alertLabel,
        estadoSemaforo: status.status,
        motivoSemaforo: status.reason
      };
    });
  }

  private positionStatus(
    position: PortfolioPosition,
    alert: { count: number; nearestDistance: number | null; nearestStatus: string; nearestNote: string | null; hasSuspiciousScale: boolean } | null,
    effective: EffectivePortfolioPosition | null
  ): { status: string; reason: string } {
    if (position.currentPrice === null || position.currentPrice === undefined || !position.classification) {
      return { status: 'Sin datos', reason: 'Falta historico, clasificacion o precio actual' };
    }
    if (alert?.hasSuspiciousScale) {
      return { status: 'Revisar alto', reason: 'Posible error de escala en alerta asociada' };
    }

    const resultPercent = effective?.effectiveResultPercent ?? position.resultPercent ?? 0;
    const resultAdjusted = effective?.resultWasAdjustedByMovements ?? false;
    const resultLabel = this.formatPercent(resultPercent);

    if (resultAdjusted && resultPercent > 0) {
      return { status: 'OK', reason: `Resultado ajustado ${resultLabel}` };
    }
    if (resultPercent < -10) {
      return { status: 'Revisar alto', reason: this.positionReviewReason(position, alert, effective) };
    }
    if ((alert?.nearestDistance !== null && Math.abs(alert?.nearestDistance ?? 0) <= 5) || resultPercent < 0 || (position.portfolioWeight ?? 0) >= 5) {
      return { status: 'Revisar', reason: this.positionReviewReason(position, alert, effective) };
    }
    return { status: 'OK', reason: `Resultado ${resultLabel}${resultAdjusted ? ' ajustado' : ''}` };
  }

  private positionReviewReason(
    position: PortfolioPosition,
    alert: { count?: number; nearestDistance: number | null; nearestNote: string | null } | null,
    effective: EffectivePortfolioPosition | null = null
  ): string {
    if (this.isFciOrLiquidityPosition(position)) {
      return 'FCI / liquidez. No usar señales tecnicas de precio.';
    }
    if (this.isCryptoPosition(position)) {
      return 'Cripto con volatilidad alta; revisar exposicion y riesgo.';
    }
    if (effective?.resultWasAdjustedByMovements) {
      const adjusted = this.formatPercent(effective.effectiveResultPercent ?? effective.nominalResultPercent ?? 0);
      return `${position.symbol} tiene resultado ajustado por movimientos de inversión: ${adjusted}. Revisar solo si querés auditar la posición.`;
    }
    if (alert?.nearestNote) {
      return `Alerta cercana: ${alert.nearestNote}`;
    }
    if (!alert?.count) {
      return 'Sin alertas manuales asociadas';
    }
    const resultPercent = effective?.effectiveResultPercent ?? position.resultPercent ?? 0;
    if (resultPercent < 0) {
      return `Resultado ${this.formatPercent(resultPercent)}`;
    }
    if ((position.portfolioWeight ?? 0) >= 5) {
      return `Peso relevante ${this.formatPercent(position.portfolioWeight)}`;
    }
    return 'Revisar seguimiento de la posicion';
  }

  private positionEffectiveKey(symbol: string, currency: string): string {
    return `${String(symbol ?? '').toUpperCase()}__${this.normalizeCurrency(currency)}`;
  }

  private buildAlerts(
    snapshot: PortfolioAppState,
    positions: PortfolioPosition[],
    alertIndex: Map<string, { count: number; nearestDistance: number | null; nearestStatus: string; nearestNote: string | null; hasSuspiciousScale: boolean }>
  ): GptPortfolioExport['alerts'] {
    const currentBySymbol = new Map(positions.map((position) => [position.symbol.toUpperCase(), position]));

    const manual = (snapshot.dataset?.manualAlerts ?? [])
      .map((alert) => {
        const current = currentBySymbol.get(alert.symbol.toUpperCase()) ?? null;
        const distance = this.distancePercent(alert.targetPrice, current?.currentPrice ?? null);
        const status = this.manualStatus(alert.condition, alert.targetPrice, current?.currentPrice, alert.status);
        return {
          especie: alert.symbol,
          condicion: alert.condition ?? 'N/D',
          precioActual: this.formatMoney(current?.currentPrice, current?.currency ?? 'ARS'),
          precioObjetivo: this.formatMoney(alert.targetPrice, current?.currency ?? 'ARS'),
          distanciaNumerica: distance,
          distanciaPercent: this.formatPercent(distance),
          estadoCalculado: status,
          estadoOriginal: alert.status ?? 'N/D',
          observacion: this.observationForManualAlert(distance, status),
          notas: alert.notes ?? 'N/D'
        };
      })
      .sort((left, right) => this.manualRank(String(left.estadoCalculado)).localeCompare(this.manualRank(String(right.estadoCalculado))));

    const calculated = (snapshot.dataset?.calculatedAlerts ?? []).map((alert) => {
      const current = currentBySymbol.get(alert.symbol.toUpperCase()) ?? null;
      const distance = this.distancePercent(alert.target, alert.currentPrice ?? current?.currentPrice ?? null);
      return {
        tipoAlerta: alert.alert ?? 'N/D',
        especie: alert.symbol,
        fecha: this.formatDate(alert.date),
        precioActual: this.formatMoney(alert.currentPrice ?? current?.currentPrice ?? null, current?.currency ?? 'ARS'),
        objetivo: this.formatMoney(alert.target ?? null, current?.currency ?? 'ARS'),
        alerta: alert.alert ?? 'N/D',
        distanciaNumerica: distance,
        distanciaPercent: this.formatPercent(distance),
        observacion: Math.abs(distance ?? 0) > 80 ? 'Posible error de escala' : 'OK'
      };
    });

    const signalBuckets = this.partitionSignals(snapshot.dataset?.signals ?? [], positions);
    return {
      manual,
      calculated,
      signals5D: signalBuckets.visible5D,
      signals30D: signalBuckets.visible30D,
      excludedSignals: signalBuckets.excluded
    };
  }

  private partitionSignals(
    signals: MarketSignal[],
    positions: PortfolioPosition[]
  ): { visible5D: ExportSignalRow[]; visible30D: ExportSignalRow[]; excluded: Array<{ especie: string; motivo: string }> } {
    const bySymbol = new Map(positions.map((position) => [position.symbol.toUpperCase(), position]));
    const visible5D: ExportSignalRow[] = [];
    const visible30D: ExportSignalRow[] = [];
    const excluded: Array<{ especie: string; motivo: string }> = [];

    for (const signal of signals) {
      const position = bySymbol.get(signal.symbol.toUpperCase()) ?? null;
      if (this.isTechnicalSignalDudosa(position)) {
        excluded.push({
          especie: signal.symbol,
          motivo: 'FCI / VALORIZADO o precio no comparable'
        });
        continue;
      }

      const row: ExportSignalRow = {
        especie: signal.symbol,
        tipoSenal: signal.signalType,
        periodo: signal.period,
        fechaInicio: this.formatDate(signal.startDate),
        precioInicio: this.formatMoney(signal.startPrice, position?.currency ?? 'ARS'),
        fechaFin: this.formatDate(signal.endDate),
        precioFin: this.formatMoney(signal.endPrice, position?.currency ?? 'ARS'),
        variacionPercent: this.formatPercent(signal.variationPercent),
        observacion: 'OK'
      };

      if (signal.period === '5D') {
        visible5D.push(row);
      } else if (signal.period === '30D') {
        visible30D.push(row);
      }
    }

    return {
      visible5D,
      visible30D,
      excluded: this.uniqueByKey(excluded, (row) => `${row.especie.toUpperCase()}|${row.motivo.toLowerCase()}`)
    };
  }

  private isTechnicalSignalDudosa(position: PortfolioPosition | null): boolean {
    const assetType = String(position?.assetType ?? '').toUpperCase();
    const positionType = String(position?.positionType ?? '').toUpperCase();
    return assetType.includes('FCI') || positionType.includes('VALORIZADO') || assetType.includes('MONEY MARKET');
  }

  private buildConcentration(positions: PortfolioPosition[], scope: ExportCurrencyScope): ExportConcentration {
    const filtered = scope === 'ALL'
      ? positions
      : positions.filter((position) => this.normalizeCurrency(position.currency) === scope);

    const totalCurrentValue = filtered.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
    const ordered = [...filtered].sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));

    const dimensionSummary = (dimension: string, selector: (position: PortfolioPosition) => string): ExportConcentrationBucket | null => {
      const bucket = new Map<string, number>();
      for (const position of filtered) {
        const key = selector(position);
        bucket.set(key, (bucket.get(key) ?? 0) + (position.currentValue ?? 0));
      }
      const orderedBucket = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
      if (!orderedBucket.length) {
        return null;
      }
      return {
        label: orderedBucket[0][0],
        weightPercent: this.percent(orderedBucket[0][1], totalCurrentValue),
        top3Labels: orderedBucket.slice(0, 3).map(([label]) => label),
        categoryCount: orderedBucket.length
      };
    };

    return {
      currencyScope: scope,
      totalCurrentValue,
      top1Percent: this.percentOfTop(ordered, totalCurrentValue, 1),
      top3Percent: this.percentOfTop(ordered, totalCurrentValue, 3),
      top5Percent: this.percentOfTop(ordered, totalCurrentValue, 5),
      top10Percent: this.percentOfTop(ordered, totalCurrentValue, 10),
      largestPosition: ordered[0] ? this.digestPosition(ordered[0]) : null,
      largestSector: dimensionSummary('Sector', (position) => position.sector || 'Sin sector'),
      largestSubsector: dimensionSummary('Subsector', (position) => position.subsector || 'Sin subsector'),
      largestRegion: dimensionSummary('Region', (position) => position.region || 'Sin region'),
      largestAssetType: dimensionSummary('Tipo de activo', (position) => position.assetType || position.positionType || 'Sin clasificar'),
      ranking: ordered.slice(0, 20).map((position, index) => ({
        rank: index + 1,
        symbol: position.symbol,
        currency: this.normalizeCurrency(position.currency),
        assetType: position.assetType ?? position.positionType ?? 'N/D',
        sector: position.sector ?? 'N/D',
        subsector: position.subsector ?? 'N/D',
        region: position.region ?? 'N/D',
        totalCurrentValue: this.formatMoney(position.currentValue, position.currency),
        weightPercent: this.percent(position.currentValue ?? 0, totalCurrentValue),
        cumulativeWeightPercent: this.percent(
          ordered.slice(0, index + 1).reduce((sum, item) => sum + (item.currentValue ?? 0), 0),
          totalCurrentValue
        )
      })),
      dimensionSummaries: [
        dimensionSummary('Especie', (position) => position.symbol),
        dimensionSummary('Tipo de activo', (position) => position.assetType || position.positionType || 'Sin clasificar'),
        dimensionSummary('Sector', (position) => position.sector || 'Sin sector'),
        dimensionSummary('Subsector', (position) => position.subsector || 'Sin subsector'),
        dimensionSummary('Region', (position) => position.region || 'Sin region')
      ].filter(Boolean) as ExportConcentration['dimensionSummaries'],
      currencyWarning: scope === 'ALL' && new Set(filtered.map((position) => this.normalizeCurrency(position.currency))).size > 1
        ? 'Sin conversion mezcla ARS y USD: usar solo como referencia visual.'
        : null
    };
  }

  private percentOfTop(positions: PortfolioPosition[], total: number, topN: number): number {
    if (!positions.length || total <= 0) {
      return 0;
    }
    const topValue = positions.slice(0, topN).reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
    return this.percent(topValue, total);
  }

  private buildDistributions(positions: PortfolioPosition[], scope: ExportCurrencyScope): GptPortfolioExport['distributions'] {
    const filtered = scope === 'ALL'
      ? positions
      : positions.filter((position) => this.normalizeCurrency(position.currency) === scope);
    const total = filtered.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);

    return {
      moneda: this.bucket(filtered, (position) => this.normalizeCurrency(position.currency), total, (label) => label),
      tipoActivo: this.bucket(filtered, (position) => position.assetType ?? position.positionType ?? 'Sin clasificar', total),
      sector: this.bucket(filtered, (position) => position.sector ?? 'Sin sector', total),
      subsector: this.bucket(filtered, (position) => position.subsector ?? 'Sin subsector', total),
      region: this.bucket(filtered, (position) => position.region ?? 'Sin region', total),
      especiesTop10: [...filtered]
        .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
        .slice(0, 10)
        .map((position) => ({
          categoria: position.symbol,
          monto: this.formatMoney(position.currentValue, position.currency),
          pesoPercent: this.formatPercent(total > 0 ? ((position.currentValue ?? 0) / total) * 100 : 0)
        }))
    };
  }

  private bucket(
    positions: PortfolioPosition[],
    selector: (position: PortfolioPosition) => string,
    total: number,
    formatter?: (label: string) => string
  ): Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies: number }> {
    const bucket = new Map<string, { value: number; count: number }>();
    for (const position of positions) {
      const key = selector(position);
      const item = bucket.get(key) ?? { value: 0, count: 0 };
      item.value += position.currentValue ?? 0;
      item.count += 1;
      bucket.set(key, item);
    }

    return Array.from(bucket.entries())
      .sort((a, b) => b[1].value - a[1].value)
      .map(([label, item]) => ({
        categoria: formatter ? formatter(label) : label,
        monto: this.formatMoney(item.value, 'ARS'),
        pesoPercent: this.formatPercent(total > 0 ? (item.value / total) * 100 : 0),
        cantidadEspecies: item.count
      }));
  }

  private buildMonthlySummary(summary: MonthlyInvestmentSummary[], options: GptPortfolioExportOptions): Array<TableRow> {
    const ordered = [...summary].sort((a, b) => this.monthKey(a.month) - this.monthKey(b.month));
    const limited = options.mode === 'full' || options.includeMonthlyHistory ? ordered : ordered.slice(-12);
    return limited.map((row) => {
      const month = this.normalizeMonthLabel(String(row.month ?? ''));
      const warnings: string[] = [];
      const values = [row.variationPercent, row.realReturnPercent, row.contributionRatio].filter((value) => typeof value === 'number') as number[];
      if (values.some((value) => Math.abs(value) > 30)) {
        warnings.push('Posible dato atipico');
      }
      if (typeof row.contributionRatio === 'number' && Math.abs(row.contributionRatio) > 100) {
        warnings.push('Ratio aporte fuera de rango');
      }
      return {
        mes: month,
        valorInicio: this.formatMoney(row.startValue, 'ARS'),
        compras: this.formatMoney(row.purchases, 'ARS'),
        ventas: this.formatMoney(row.sales, 'ARS'),
        valorFin: this.formatMoney(row.endValue, 'ARS'),
        resultado: this.formatMoney(row.result, 'ARS'),
        variacionPercent: this.formatPercent(row.variationPercent),
        inflacionPercent: this.formatPercent(row.inflationPercent),
        rendimientoRealPercent: this.formatPercent(row.realReturnPercent),
        rendimientoRealAcumPercent: this.formatPercent(row.accumulatedRealReturnPercent),
        ratioAporte: this.formatPercent(row.contributionRatio),
        observacion: warnings.length ? warnings.join(' · ') : 'OK'
      };
    });
  }

  private buildAnnualSummary(summary: AnnualInvestmentSummary[]): Array<TableRow> {
    return [...summary]
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
      .map((row) => ({
        anio: row.year,
        valorInicio: this.formatMoney(row.startValue, 'ARS'),
        compras: this.formatMoney(row.purchases, 'ARS'),
        ventas: this.formatMoney(row.sales, 'ARS'),
        valorFin: this.formatMoney(row.endValue, 'ARS'),
        resultado: this.formatMoney(row.result, 'ARS'),
        rendimientoPercent: this.formatPercent(row.returnPercent),
        inflacion: this.formatPercent(row.inflation),
        rendimientoReal: this.formatPercent(row.realReturn),
        ratioAporte: this.formatPercent(row.contributionRatio)
      }));
  }

  private buildStrategicSplit(strategicSplit: StrategicSplit[], totalPortfolioValue: number): GptPortfolioExport['strategicSplit'] {
    if (!strategicSplit.length) {
      return null;
    }

    const ordered = [...strategicSplit].sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
    const last = ordered[ordered.length - 1];
    const summedRetirementAmountARS = ordered.reduce((sum, item) => sum + Number(item.retirementAmountARS ?? 0), 0);
    const summedRetirementAmountUSD = ordered.reduce((sum, item) => sum + Number(item.retirementAmountUSD ?? 0), 0);
    const summedSavingsAmountARS = ordered.reduce((sum, item) => sum + Number(item.savingsAmountARS ?? 0), 0);
    const summedSavingsAmountUSD = ordered.reduce((sum, item) => sum + Number(item.savingsAmountUSD ?? 0), 0);
    const arsTotal = summedRetirementAmountARS + summedSavingsAmountARS;
    const usdTotal = summedRetirementAmountUSD + summedSavingsAmountUSD;
    const arsRetirementPercent = arsTotal > 0 ? (summedRetirementAmountARS / arsTotal) * 100 : null;
    const usdRetirementPercent = usdTotal > 0 ? (summedRetirementAmountUSD / usdTotal) * 100 : null;
    const percentSamples = [arsRetirementPercent, usdRetirementPercent].filter((value): value is number => value !== null);
    const retirementPercent = percentSamples.length ? percentSamples.reduce((sum, value) => sum + value, 0) / percentSamples.length : null;
    const savingsPercent = retirementPercent !== null ? 100 - retirementPercent : null;
    const maxValueARS = Math.max(...ordered.map((item) => Number(item.valueARS ?? 0)));
    const maxValueUSD = Math.max(...ordered.map((item) => Number(item.valueUSD ?? 0)));
    const scaleIssue = totalPortfolioValue > 0 && maxValueARS > 0 && maxValueARS < totalPortfolioValue * 0.02 && maxValueUSD <= totalPortfolioValue * 0.02;

    return {
      fecha: this.formatDate(last.date),
      jubilacionPercent: this.formatPercent(retirementPercent),
      ahorroPercent: this.formatPercent(savingsPercent),
      desvioPercent: this.formatPercent(Math.abs((retirementPercent ?? 0) - 50)),
      montoJubilacionARS: scaleIssue ? 'N/D' : this.formatMoney(summedRetirementAmountARS, 'ARS'),
      montoAhorroARS: scaleIssue ? 'N/D' : this.formatMoney(summedSavingsAmountARS, 'ARS'),
      montoJubilacionUSD: scaleIssue ? 'N/D' : this.formatMoney(summedRetirementAmountUSD, 'USD'),
      montoAhorroUSD: scaleIssue ? 'N/D' : this.formatMoney(summedSavingsAmountUSD, 'USD'),
      warning: scaleIssue ? 'La escala de Tabla35 parece inconsistente con el valor total del portafolio.' : null
    };
  }

  private buildSimulation(viewModel: DecisionViewModel, options: GptPortfolioExportOptions): ExportSimulation | null {
    if (!viewModel.simulationInputs.active) {
      return null;
    }
    return {
      moneda: options.simulationCurrency,
      aporteMensual: this.formatMoney(viewModel.simulationInputs.monthlyContribution, options.simulationCurrency),
      meses: viewModel.simulationInputs.months,
      rendimientoAnualEsperadoPercent: this.formatPercent(viewModel.simulationInputs.annualReturnPercent),
      valorProyectado: viewModel.simulation.projectedValue,
      gananciaEstimada: viewModel.simulation.projectedGain,
      aclaracion: 'Esta proyeccion es un escenario manual, no una prediccion.'
    };
  }

  private buildBenchmarkMinimum(opportunities: DecisionOpportunitiesViewModel): ExportBenchmarkMinimum {
    const review = opportunities.minimumBenchmarkReview;
    const summary = review.summary
      ? {
          balanceVsMinimumArs: review.summary.balanceVsMinimumArs !== null ? this.formatMoney(review.summary.balanceVsMinimumArs, 'ARS') : null,
          balanceVsMinimumPercentArs: review.summary.balanceVsMinimumPercentArs !== null ? this.formatPercent(review.summary.balanceVsMinimumPercentArs) : null,
          currentComparableArs: review.summary.currentComparableArs !== null ? this.formatMoney(review.summary.currentComparableArs, 'ARS') : null,
          minimumExpectedArs: review.summary.minimumExpectedArs !== null ? this.formatMoney(review.summary.minimumExpectedArs, 'ARS') : null,
          comparableLotsCount: review.summary.comparableLotsCount,
          status: review.summary.status,
          description: review.summary.description
        }
      : null;

    return {
      summary,
      totalBelowMinimum: review.totalBelowMinimum,
      positionsBelowMinimumShown: review.items.length,
      positionsBelowMinimum: review.items.map((item) => ({
        especie: item.symbol,
        moneda: item.currency,
        vsMinimo: this.formatMoney(item.valueVsMinimumAmount, item.currency),
        percentVsMinimo: this.formatPercent(item.valueVsMinimumPercent),
        motivo: item.reason
      }))
    };
  }

  private buildMovementAdjustments(
    movementSummaries: Array<{
      symbol: string;
      currency: string;
      incomeAmount: number;
      capitalReturnedAmount: number;
      marketResultAmount: number;
      marketResultPercent: number | null;
      adjustedResultAmount: number;
      adjustedResultPercent: number | null;
      hasAdjustments: boolean;
      notes: string[];
    }>
  ): ExportMovementAdjustmentRow[] {
    return [...movementSummaries]
      .filter((item) => item.hasAdjustments)
      .sort((a, b) => Math.abs((b.adjustedResultAmount ?? 0) - (b.marketResultAmount ?? 0)) - Math.abs((a.adjustedResultAmount ?? 0) - (a.marketResultAmount ?? 0)))
      .slice(0, 5)
      .map((item) => ({
        especie: item.symbol,
        moneda: this.normalizeCurrency(item.currency),
        rentasCobradas: this.formatMoney(item.incomeAmount, item.currency),
        amortizacionesCobradas: this.formatMoney(item.capitalReturnedAmount, item.currency),
        resultadoSinAjuste: this.formatMoney(item.marketResultAmount, item.currency),
        resultadoAjustado: this.formatMoney(item.adjustedResultAmount, item.currency),
        resultadoAjustadoPercent: this.formatPercent(item.adjustedResultPercent),
        nota: item.notes.includes('Movimientos detectados, pero no se pudieron aplicar al benchmark mínimo.')
          ? 'Movimientos detectados'
          : 'Resultado ajustado por movimientos'
      }));
  }

  private buildDecisionInsights(
    viewModel: DecisionViewModel,
    positions: PortfolioPosition[],
    concentration: ExportConcentration,
    alerts: GptPortfolioExport['alerts'],
    movementSummaryBySymbol: Map<string, { adjustedResultPercent: number | null; hasAdjustments: boolean; adjustedResultAmount: number | null }>
  ): GptPortfolioExport['decisionInsights'] {
    const comparableResult = (position: PortfolioPosition) => this.exportResultPercent(position, movementSummaryBySymbol);
    const orderedByResult = [...positions].sort((a, b) => comparableResult(a) - comparableResult(b));
    const bestByResult = [...positions].sort((a, b) => comparableResult(b) - comparableResult(a));
    const semales = [
      ...alerts.signals5D.slice(0, 5).map((row) => ({ symbol: row.especie, signalType: row.tipoSenal, period: row.periodo })),
      ...alerts.signals30D.slice(0, 5).map((row) => ({ symbol: row.especie, signalType: row.tipoSenal, period: row.periodo }))
    ];

    return {
      semaforo: viewModel.trafficLightLabel,
      motivo: viewModel.trafficLightReason,
      acciones: viewModel.actions.slice(0, 5),
      saludDatos: {
        criticalProblems: viewModel.ready ? 0 : 1,
        warnings: 0,
        status: viewModel.ready ? 'ok' : 'warning'
      },
      referenciasConcentracion: [
        { label: 'Top 1', currentPercent: concentration.top1Percent, targetPercent: 20, gapPercent: concentration.top1Percent - 20 },
        { label: 'Top 3', currentPercent: concentration.top3Percent, targetPercent: 45, gapPercent: concentration.top3Percent - 45 },
        { label: 'Top 5', currentPercent: concentration.top5Percent, targetPercent: 60, gapPercent: concentration.top5Percent - 60 },
        { label: 'Top 10', currentPercent: concentration.top10Percent, targetPercent: 80, gapPercent: concentration.top10Percent - 80 }
      ],
      senalesActivas: semales,
      peorPosicion: orderedByResult[0] ? this.digestPosition(orderedByResult[0], movementSummaryBySymbol) : null,
      mejorPosicion: bestByResult[0] ? this.digestPosition(bestByResult[0], movementSummaryBySymbol) : null,
      mayorConcentracion: concentration.largestAssetType?.label ?? 'N/D',
      advertenciasImportantes: [
        ...(concentration.currencyWarning ? [concentration.currencyWarning] : []),
        ...(alerts.excludedSignals.length ? [`${alerts.excludedSignals.length} señales excluidas o dudosas`] : [])
      ]
    };
  }

  private buildDataReview(
    viewModel: DecisionViewModel,
    findings: Array<{ severity: string; source: string; symbol: string | null; problem: string; suggestion: string }>,
    alerts: GptPortfolioExport['alerts'],
    strategicSplit: GptPortfolioExport['strategicSplit'],
    monthlySummary: Array<TableRow>,
    simulation: ExportSimulation | null,
    snapshot: PortfolioAppState,
    options: GptPortfolioExportOptions
  ): ExportDataReviewItem[] {
    const items: ExportDataReviewItem[] = findings.map((finding) => ({
      severidad: finding.severity,
      fuente: finding.source,
      especie: finding.symbol ?? 'General',
      problema: finding.problem,
      sugerencia: finding.suggestion
    }));

    for (const row of alerts.manual) {
      if (row.observacion === 'Posible error de escala') {
        items.push({
          severidad: 'warning',
          fuente: 'ObjetivosPorEspecie',
          especie: row.especie,
          problema: 'Alerta con distancia extrema',
          sugerencia: 'Revisar escala del precio objetivo'
        });
      }
    }

    for (const row of alerts.excludedSignals) {
      items.push({
        severidad: 'warning',
        fuente: 'Señales',
        especie: row.especie,
        problema: row.motivo,
        sugerencia: 'Excluir de señales técnicas principales'
      });
    }

    if (strategicSplit?.warning) {
      items.push({
        severidad: 'warning',
        fuente: 'Tabla35',
        especie: 'General',
        problema: strategicSplit.warning,
        sugerencia: 'Usar solo porcentajes o revisar la escala del Excel.'
      });
    }

    for (const month of monthlySummary) {
      const obs = String(month['observacion'] ?? 'OK');
      if (obs !== 'OK') {
        items.push({
          severidad: 'info',
          fuente: 'HistorialMensualReconstruido',
          especie: String(month['mes'] ?? 'General'),
          problema: obs,
          sugerencia: 'Revisar valores del mes en el Excel'
        });
      }
    }

    if (!viewModel.simulationInputs.active || simulation === null) {
      items.push({
        severidad: 'info',
        fuente: 'Simulacion',
        especie: 'General',
        problema: 'No hay simulacion activa',
        sugerencia: 'Configurar aporte mensual, meses y rendimiento anual para exportarla.'
      });
    }

    if (snapshot.dataset?.strategicSplit?.length && !strategicSplit?.warning) {
      items.push({
        severidad: 'info',
        fuente: 'Tabla35',
        especie: 'General',
        problema: 'Tabla35 detectada',
        sugerencia: 'Revisar si los montos y porcentajes son coherentes con el portafolio.'
      });
    }

    const unique = this.uniqueByKey(items, (item) =>
      `${item.severidad.toLowerCase()}|${item.fuente.toLowerCase()}|${item.especie.toLowerCase()}|${item.problema.toLowerCase()}|${item.sugerencia.toLowerCase()}`
    );

    if (options.mode === 'full') {
      return unique;
    }

    const severityRank = (value: string): number => {
      switch (value.toLowerCase()) {
        case 'critical':
          return 0;
        case 'warning':
          return 1;
        case 'info':
          return 2;
        default:
          return 3;
      }
    };

    return [...unique].sort((a, b) => severityRank(a.severidad) - severityRank(b.severidad)).slice(0, 10);
  }

  private buildRecentMovements(snapshot: PortfolioAppState, options: GptPortfolioExportOptions): ExportRecentMovements {
    const operations = [...(snapshot.dataset?.operations ?? [])]
      .filter((operation) => Boolean(operation.symbol))
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
    const sales = [...(snapshot.dataset?.sales ?? [])]
      .filter((sale) => Boolean(sale.symbol))
      .sort((a, b) => this.dateValue(a.sellDate ?? a.buyDate) - this.dateValue(b.sellDate ?? b.buyDate));
    const currentPositions = new Set((snapshot.dataset?.positions ?? []).map((position) => position.symbol.toUpperCase()));
    const normalizedRange = this.movementDateRangeService.normalizeForSnapshot(options.movementDateRange, snapshot);
    const parsedRange = this.movementDateRangeService.parseMovementRange(normalizedRange);
    const bounds = this.movementDateRangeService.availableBounds(snapshot);
    const referenceDate = parsedRange.to ?? bounds.to ?? new Date();
    const startDate = parsedRange.from ?? bounds.from ?? referenceDate;

    const inPeriod = (value: string | Date | null | undefined) => {
      const time = this.dateValue(value);
      return time >= startDate.getTime() && time <= referenceDate.getTime();
    };

    const recentPurchases = operations.filter((operation) => inPeriod(operation.date));
    const recentSales = sales.filter((sale) => inPeriod(sale.sellDate ?? sale.buyDate));
    const currencyBuckets = new Map<'ARS' | 'USD', {
      purchasesGross: number;
      salesGross: number;
      purchaseCount: number;
      saleCount: number;
    }>();

    for (const currency of ['ARS', 'USD'] as const) {
      currencyBuckets.set(currency, {
        purchasesGross: 0,
        salesGross: 0,
        purchaseCount: 0,
        saleCount: 0
      });
    }

    const purchaseAmount = (operation: InvestmentOperation): number => {
      return Number(operation.total ?? operation.amount ?? 0);
    };

    const saleAmount = (sale: InvestmentSale): number => {
      const quantity = Number(sale.quantity ?? 0);
      const fallback = Number(sale.sellPrice ?? 0) * quantity;
      return Number(sale.total ?? sale.amount ?? sale.currentValue ?? fallback ?? 0);
    };

    for (const operation of recentPurchases) {
      const currency = this.normalizeCurrency(operation.currency);
      const bucket = currencyBuckets.get(currency);
      if (!bucket) continue;
      bucket.purchaseCount += 1;
      bucket.purchasesGross += purchaseAmount(operation);
    }

    for (const sale of recentSales) {
      const currency = this.normalizeCurrency(sale.currency);
      const bucket = currencyBuckets.get(currency);
      if (!bucket) continue;
      bucket.saleCount += 1;
      bucket.salesGross += saleAmount(sale);
    }

    const firstPurchaseBySymbol = new Map<string, InvestmentOperation>();
    for (const operation of operations) {
      const key = operation.symbol.toUpperCase();
      if (!firstPurchaseBySymbol.has(key)) {
        firstPurchaseBySymbol.set(key, operation);
      }
    }

    const newPositions = this.uniqueByKey(
      recentPurchases
        .map((operation) => {
          const firstPurchase = firstPurchaseBySymbol.get(operation.symbol.toUpperCase()) ?? operation;
          if (!inPeriod(firstPurchase.date)) {
            return null;
          }
          const symbol = operation.symbol.toUpperCase();
          const symbolPurchases = recentPurchases.filter((item) => item.symbol.toUpperCase() === symbol);
          const gross = symbolPurchases.reduce((sum, item) => sum + purchaseAmount(item), 0);
          return {
            symbol,
            currency: this.normalizeCurrency(operation.currency),
            firstPurchaseDate: this.formatDate(firstPurchase.date),
            purchasesInPeriod: symbolPurchases.length,
            purchasesGross: this.formatMoney(gross, operation.currency),
            note: 'Primera compra dentro del periodo'
          };
        })
        .filter((item) => item !== null) as Array<{
          symbol: string;
          currency: string;
          firstPurchaseDate: string;
          purchasesInPeriod: number;
          purchasesGross: string;
          note: string;
        }>,
      (item) => item.symbol
    );

    const closedPositions = this.uniqueByKey(
      recentSales
        .filter((sale) => !currentPositions.has(sale.symbol.toUpperCase()))
        .map((sale) => ({
          symbol: sale.symbol.toUpperCase(),
          currency: this.normalizeCurrency(sale.currency),
          saleDate: this.formatDate(sale.sellDate ?? sale.buyDate),
          buyDate: this.formatDate(sale.buyDate),
          note: 'Venta reciente sin posicion actual en TablaPosiciones'
        })),
      (item) => item.symbol
    );

    const toMovementRow = (kind: 'Compra' | 'Venta', symbol: string, currency: string, date: string | Date | null | undefined, quantity: number | null | undefined, amount: number | null | undefined): ExportRecentMovementRow => ({
      symbol,
      currency: this.normalizeCurrency(currency),
      date: this.formatDate(date),
      quantity: this.maskOrFormatNumber(quantity, options, 4),
      amount: this.maskOrFormatMoney(amount, currency, options),
      note: kind
    });

    return {
      movementDateRange: normalizedRange,
      rangeLabel: this.movementDateRangeService.formatRangeLabel(normalizedRange),
      rangePresetLabel: this.movementDateRangeService.labelForPreset(normalizedRange.preset),
      referenceDate: this.formatDate(referenceDate),
      startDate: this.formatDate(startDate),
      manualContext: options.manualContext,
      summaryByCurrency: Array.from(currencyBuckets.entries()).map(([currency, bucket]) => ({
        currency,
        purchasesGross: this.formatMoney(bucket.purchasesGross, currency),
        salesGross: this.formatMoney(bucket.salesGross, currency),
        operatingFlow: this.formatMoney(bucket.salesGross - bucket.purchasesGross, currency),
        purchaseCount: bucket.purchaseCount,
        saleCount: bucket.saleCount
      })),
      newPositions,
      closedPositions,
      recentPurchases: recentPurchases
        .slice(-10)
        .reverse()
        .map((operation) => toMovementRow('Compra', operation.symbol, operation.currency, operation.date, operation.quantity, purchaseAmount(operation))),
      recentSales: recentSales
        .slice(-10)
        .reverse()
        .map((sale) => toMovementRow('Venta', sale.symbol, sale.currency, sale.sellDate ?? sale.buyDate, sale.quantity, saleAmount(sale)))
    };
  }

  private buildOperationsBySymbol(
    operations: InvestmentOperation[],
    positions: PortfolioPosition[],
    options: GptPortfolioExportOptions
  ): Record<string, TableRow[]> {
    const currentBySymbol = new Map(positions.map((position) => [position.symbol.toUpperCase(), position]));
    const grouped = new Map<string, InvestmentOperation[]>();

    for (const operation of operations) {
      const bucket = grouped.get(operation.symbol.toUpperCase()) ?? [];
      bucket.push(operation);
      grouped.set(operation.symbol.toUpperCase(), bucket);
    }

    const result: Record<string, TableRow[]> = {};
    for (const [symbol, rows] of grouped.entries()) {
      const current = currentBySymbol.get(symbol) ?? null;
      const ordered = [...rows].sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
      const slice = options.mode === 'summary' ? ordered.slice(-5) : ordered;
      result[symbol] = slice.map((operation) => {
        const invested = operation.total ?? operation.amount ?? null;
        const resultAmount = this.operationResult(operation, current);
        const resultPercent = this.operationResultPercent(operation, current);
        return {
          id: operation.id,
          fecha: this.formatDate(operation.date),
          moneda: this.normalizeCurrency(operation.currency),
          cantidad: this.maskOrFormatNumber(operation.quantity, options, 4),
          precioCompra: this.maskOrFormatMoney(operation.buyPrice, operation.currency, options),
          totalInvertido: this.maskOrFormatMoney(invested, operation.currency, options),
          precioActual: this.maskOrFormatMoney(operation.currentPrice ?? current?.currentPrice ?? null, operation.currency, options),
          valorActual: this.maskOrFormatMoney(operation.currentValue ?? current?.currentValue ?? null, operation.currency, options),
          resultadoMonto: this.maskOrFormatMoney(resultAmount, operation.currency, options),
          resultadoPercent: this.maskOrFormatPercent(resultPercent, options)
        };
      });
    }

    return result;
  }

  private renderMarkdown(exportData: GptPortfolioExport, options: GptPortfolioExportOptions): string {
    const lines: string[] = [];
    lines.push('# Contexto semanal de portafolio', '');
    lines.push(`Fecha de generacion: ${exportData.metadata.generatedAt}`);
    lines.push('');
    lines.push(this.glossaryMarkdown(), '');
    lines.push(this.executiveSummaryMarkdown(exportData));
    lines.push('');
    lines.push(this.generalSummaryMarkdown(exportData.summary.general));
    lines.push('');
    lines.push(this.currencySummaryMarkdown('ARS', exportData.summary.ars));
    lines.push('');
    lines.push(this.currencySummaryMarkdown('USD', exportData.summary.usd));
    lines.push('');
    lines.push(this.latestBalanceMarkdown(exportData.summary.latestBalance));
    lines.push('');
    lines.push(this.pendingOrdersMarkdown(exportData.pendingOrders), '');
    lines.push('');
    lines.push(this.benchmarkMinimumMarkdown(exportData));
    lines.push('');
    lines.push(this.positionsMarkdown(exportData, options));
    lines.push('');
    lines.push(this.recentMovementsMarkdown(exportData.recentMovements), '');

    if (options.mode === 'full' || options.includeFullPurchases) {
      lines.push('## Compras y lotes individuales', this.operationsMarkdown(exportData.operationsBySymbol), '');
    } else {
      lines.push('## Compras y lotes individuales', 'Modo resumido: se omiten lotes extensos. Revisa la exportacion completa para el detalle total.', '');
    }

    if (options.mode === 'full') {
      lines.push(this.manualAlertsMarkdown(exportData.alerts.manual), '');
      lines.push(this.calculatedAlertsMarkdown(exportData.alerts.calculated), '');
    } else {
      lines.push(this.activatedAlertsMarkdown(exportData), '');
    }

    if (options.includeSignals) {
      lines.push(this.signalsMarkdown('Señales 5D', exportData.alerts.signals5D), '');
      lines.push(this.signalsMarkdown('Señales 30D', exportData.alerts.signals30D), '');
      if (exportData.alerts.excludedSignals.length) {
        lines.push(this.excludedSignalsMarkdown(exportData.alerts.excludedSignals), '');
      }
    }

    lines.push(this.concentrationMarkdown(exportData.concentration), '');
    lines.push(this.distributionMarkdown(exportData.distributions, options), '');
    lines.push(this.insightsMarkdown(exportData.decisionInsights), '');

    if (options.includeDataReview) {
      lines.push(this.dataReviewMarkdown(exportData.dataReview), '');
    }

    lines.push(this.historyMarkdown(exportData.monthlySummary, exportData.annualSummary, options), '');
    lines.push(this.splitMarkdown(exportData.strategicSplit), '');

    if (options.includeSimulation && exportData.simulation) {
      lines.push(this.simulationMarkdown(exportData.simulation), '');
    } else {
      lines.push('## Simulacion / escenario actual', 'No hay simulacion activa.', '');
    }

    lines.push('## Foco sugerido de la semana');
    for (const line of this.weeklyFocus(exportData)) {
      lines.push(`- ${line}`);
    }
    return lines.join('\n');
  }

  private executiveSummaryMarkdown(exportData: GptPortfolioExport): string {
    return [
      '## Resumen ejecutivo para ChatGPT',
      `- ${exportData.summary.warning}`,
      `- Valor actual ARS: ${exportData.summary.ars.totalCurrentValue}`,
      `- Valor actual USD: ${exportData.summary.usd.totalCurrentValue}`,
      `- Resultado ARS: ${exportData.summary.ars.totalResult}`,
      `- Resultado USD: ${exportData.summary.usd.totalResult}`,
      `- Balance vs mínimo ARS: ${exportData.benchmarkMinimum.summary?.balanceVsMinimumArs ?? 'N/D'} / ${exportData.benchmarkMinimum.summary?.balanceVsMinimumPercentArs ?? 'N/D'}`,
      `- Posiciones bajo benchmark mínimo: ${exportData.benchmarkMinimum.totalBelowMinimum}`,
      `- Peores posiciones bajo benchmark mínimo mostradas: ${exportData.benchmarkMinimum.positionsBelowMinimumShown}`,
      `- Alertas activadas: ${this.activatedAlertSymbols(exportData).slice(0, 5).join(', ') || 'N/D'}`,
      `- Principales posiciones por peso: ${exportData.concentration.ranking.slice(0, 5).map((item) => item.symbol).join(', ') || 'N/D'}`,
      `- Mayor concentracion por tipo de activo: ${exportData.concentration.largestAssetType?.label ?? 'N/D'}`,
      `- Mayor sector: ${exportData.concentration.largestSector?.label ?? 'N/D'}`,
      `- Mayor region: ${exportData.concentration.largestRegion?.label ?? 'N/D'}`,
      `- Alertas cercanas: ${this.nearAlertSymbols(exportData).join(', ') || 'N/D'}`,
      `- Peor posicion${exportData.decisionInsights.peorPosicion?.note ? ' (ajustada)' : ''}: ${exportData.decisionInsights.peorPosicion?.symbol ?? 'N/D'}`,
      `- Mejor posicion${exportData.decisionInsights.mejorPosicion?.note ? ' (ajustada)' : ''}: ${exportData.decisionInsights.mejorPosicion?.symbol ?? 'N/D'}`,
      `- Señales 30D de caida: ${this.signalSymbols(exportData.alerts.signals30D).join(', ') || 'N/D'}`,
      `- Datos a revisar: ${exportData.dataReview.length ? 'Si' : 'No detectados por el frontend'}`
    ].join('\n');
  }

  private glossaryMarkdown(): string {
    return [
      '## Glosario de metricas',
      '- Valor actual: valor de mercado actual de la posicion. No incluye rentas ni amortizaciones cobradas.',
      '- Resultado nominal: Valor actual - Total invertido.',
      '- Resultado efectivo: resultado usado para analisis cuando hay movimientos de inversion. En posiciones con rentas/amortizaciones, incluye Valor actual + rentas + amortizaciones - Total invertido. En posiciones sin movimientos coincide con el resultado nominal.',
      '- Minimo esperado: valor minimo que deberia alcanzar la inversion para empatar el benchmark minimo de TablaCalendario.',
      '- Vs minimo: diferencia entre el valor comparable y el minimo esperado.',
      '- % vs minimo: diferencia porcentual contra el minimo esperado. No es lo mismo que Resultado %.',
      '- Valor comparable: valor usado para comparar contra el minimo esperado. En posiciones normales es el Valor actual. En posiciones con movimientos es Valor actual + rentas + amortizaciones.'
    ].join('\n');
  }

  private generalSummaryMarkdown(summary: ExportSummaryScope): string {
    return [
      '## Resumen general sin conversion',
      'Este total mezcla ARS y USD sin convertir. Usar solo como referencia visual.',
      `- Valor actual total: ${summary.totalCurrentValue}`,
      `- Total invertido: ${summary.totalInvested}`,
      `- Resultado total: ${summary.totalResult}`,
      `- Resultado %: ${summary.totalResultPercent}`,
      `- Cantidad de especies: ${summary.speciesCount}`
    ].join('\n');
  }

  private currencySummaryMarkdown(currency: 'ARS' | 'USD', summary: ExportSummaryScope): string {
    return [
      `## ${currency}`,
      `- Valor actual ${currency}: ${summary.totalCurrentValue}`,
      `- Total invertido ${currency}: ${summary.totalInvested}`,
      `- Resultado ${currency}: ${summary.totalResult}`,
      `- Resultado % ${currency}: ${summary.totalResultPercent}`,
      `- Cantidad de especies ${currency}: ${summary.speciesCount}`
    ].join('\n');
  }

  private latestBalanceMarkdown(latest: LatestBalanceDigest): string {
    return [
      '## Resultado del día',
      '- Este valor no es el valor del portafolio. Es la suma diaria por especie de la diferencia entre el precio actual y el del día anterior.',
      `- Resultado del día actual: ${latest.currentValue ?? 'N/D'}`,
      `- Fecha del resultado del día: ${latest.currentDate ?? 'N/D'}`,
      `- Resultado del día anterior: ${latest.previousValue ?? 'N/D'}`,
      `- Mejor resultado diario: ${latest.bestValue ?? 'N/D'}`,
      `- Fecha mejor resultado: ${latest.bestDate ?? 'N/D'}`,
      `- Peor resultado diario: ${latest.worstValue ?? 'N/D'}`,
      `- Fecha peor resultado: ${latest.worstDate ?? 'N/D'}`
    ].join('\n');
  }

  private positionsMarkdown(exportData: GptPortfolioExport, options: GptPortfolioExportOptions): string {
    const rows = exportData.positions;

    if (!rows.length) {
      return '## Posiciones actuales\n\nNo hay posiciones.';
    }
    const columns = options.mode === 'full'
      ? [
          { header: 'Especie', key: 'especie' },
          { header: 'Moneda', key: 'moneda' },
          { header: 'Tipo activo', key: 'tipoActivo' },
          { header: 'Sector', key: 'sector' },
          { header: 'Subsector', key: 'subsector' },
          { header: 'Region', key: 'region' },
          { header: 'Cantidad', key: 'cantidad' },
          { header: 'Precio promedio', key: 'precioPromedio' },
          { header: 'Precio actual', key: 'precioActual' },
          { header: 'Total invertido', key: 'totalInvertido' },
          { header: 'Total actual', key: 'totalActual' },
          { header: 'Resultado nominal $', key: 'resultadoNominalMonto' },
          { header: 'Resultado nominal %', key: 'resultadoNominalPercent' },
          { header: 'Resultado efectivo $', key: 'resultadoEfectivoMonto' },
          { header: 'Resultado efectivo %', key: 'resultadoEfectivoPercent' },
          { header: 'Valor comparable', key: 'valorComparable' },
          { header: 'Mínimo esperado', key: 'minimoEsperado' },
          { header: 'Vs mínimo', key: 'vsMinimo' },
          { header: '% vs mínimo', key: 'percentVsMinimo' },
          { header: 'Estado benchmark', key: 'estadoBenchmark' },
          { header: 'Peso %', key: 'pesoPercent' }
        ]
      : [
          { header: 'Especie', key: 'especie' },
          { header: 'Moneda', key: 'moneda' },
          { header: 'Tipo activo', key: 'tipoActivo' },
          { header: 'Sector', key: 'sector' },
          { header: 'Subsector', key: 'subsector' },
          { header: 'Region', key: 'region' },
          { header: 'Cantidad', key: 'cantidad' },
          { header: 'Precio promedio', key: 'precioPromedio' },
          { header: 'Precio actual', key: 'precioActual' },
          { header: 'Total invertido', key: 'totalInvertido' },
          { header: 'Total actual', key: 'totalActual' },
          { header: 'Resultado efectivo $', key: 'resultadoEfectivoMonto' },
          { header: 'Resultado efectivo %', key: 'resultadoEfectivoPercent' },
          { header: 'Valor comparable', key: 'valorComparable' },
          { header: 'Mínimo esperado', key: 'minimoEsperado' },
          { header: 'Vs mínimo', key: 'vsMinimo' },
          { header: '% vs mínimo', key: 'percentVsMinimo' },
          { header: 'Estado benchmark', key: 'estadoBenchmark' },
          { header: 'Peso %', key: 'pesoPercent' }
        ];

    return ['## Posiciones actuales', this.tableFromRows(rows, columns)].join('\n');
  }

  private activatedAlertsMarkdown(exportData: GptPortfolioExport): string {
    const rows = this.activatedAlertRows(exportData);
    if (!rows.length) {
      return '## Alertas activadas\n\nSin alertas activadas.';
    }
    return ['## Alertas activadas', this.tableFromRows(rows, [
      { header: 'Especie', key: 'especie' },
      { header: 'Condición', key: 'condicion' },
      { header: 'Precio actual', key: 'precioActual' },
      { header: 'Precio objetivo', key: 'precioObjetivo' },
      { header: 'Distancia %', key: 'distanciaPercent' },
      { header: 'Notas', key: 'notas' }
    ])].join('\n');
  }

  private benchmarkMinimumMarkdown(exportData: GptPortfolioExport): string {
    const review = exportData.opportunities.minimumBenchmarkReview;
    if (!exportData.benchmarkMinimum.summary) {
      return '## Benchmark mínimo ARS\n\nNo hay datos suficientes para calcular benchmark mínimo.';
    }

    const summary = exportData.benchmarkMinimum.summary;
    const lines = [
      '## Benchmark mínimo ARS',
      `- Balance vs mínimo ARS: ${summary.balanceVsMinimumArs ?? 'N/D'}`,
      `- % vs mínimo ARS: ${summary.balanceVsMinimumPercentArs ?? 'N/D'}`,
      `- Valor comparable ARS: ${summary.currentComparableArs ?? 'N/D'}`,
      `- Mínimo esperado ARS: ${summary.minimumExpectedArs ?? 'N/D'}`,
      `- Posiciones ARS comparables: ${summary.comparableLotsCount}`,
      `- Posiciones debajo del mínimo: ${exportData.benchmarkMinimum.totalBelowMinimum}`,
      `- Posiciones listadas abajo: ${exportData.benchmarkMinimum.positionsBelowMinimumShown}`,
      '- Nota: el valor comparable no es el valor de mercado; se usa solo para comparar contra el mínimo esperado.'
    ];

    if (exportData.benchmarkMinimum.positionsBelowMinimum.length) {
      lines.push('', '### Peores posiciones bajo benchmark mínimo');
      lines.push('> Esta tabla muestra solo las peores posiciones por % vs mínimo.');
      lines.push('> El listado completo está en “Posiciones actuales”, columnas `Valor comparable`, `Mínimo esperado`, `Vs mínimo`, `% vs mínimo` y `Estado benchmark`.');
      lines.push(this.tableFromRows(exportData.benchmarkMinimum.positionsBelowMinimum, [
        { header: 'Especie', key: 'especie' },
        { header: 'Moneda', key: 'moneda' },
        { header: 'Vs mínimo', key: 'vsMinimo' },
        { header: '% vs mínimo', key: 'percentVsMinimo' },
        { header: 'Motivo', key: 'motivo' }
      ]));
    }

    return lines.join('\n');
  }

  private buildPendingOrders(snapshot: PortfolioAppState): ExportPendingOrders {
    const summary = snapshot.dataset?.pendingOrders ?? {
      orders: [],
      summaryBySymbol: [],
      totalOrders: 0,
      totalReservedARS: 0,
      cashTreatment: 'reserved_not_available_cash' as const,
      includedInCurrentPositions: false as const,
      includedInAvailableCash: false as const,
      warnings: []
    };

    return {
      description: 'Órdenes pendientes de compra. El capital ya fue reservado y no forma parte del cash disponible declarado.',
      cashTreatment: summary.cashTreatment,
      includedInCurrentPositions: summary.includedInCurrentPositions,
      includedInAvailableCash: summary.includedInAvailableCash,
      totalOrders: summary.totalOrders,
      totalReservedARS: summary.totalReservedARS,
      orders: summary.orders.map((order) => ({
        symbol: order.symbol,
        quantity: order.quantity,
        limitPriceARS: order.limitPriceARS,
        reservedAmountARS: order.reservedAmountARS
      })),
      summaryBySymbol: summary.summaryBySymbol.map((item) => ({
        symbol: item.symbol,
        totalQuantity: item.totalQuantity,
        totalReservedARS: item.totalReservedARS,
        averageLimitPriceARS: item.averageLimitPriceARS,
        ordersCount: item.ordersCount
      })),
      gptInstruction:
        'Estas órdenes no son posiciones actuales. No sumarlas al valor actual del portafolio. No descontar su capital del cash disponible porque ese capital ya fue apartado. Considerarlas solo como exposición futura probable.'
    };
  }

  private pendingOrdersMarkdown(pendingOrders: ExportPendingOrders): string {
    const lines = [
      '## Órdenes pendientes de compra, capital ya reservado',
      'Estas órdenes fueron cargadas en el broker pero todavía no están ejecutadas. No forman parte de las posiciones actuales y no deben sumarse al valor actual del portafolio. El capital necesario para ejecutarlas ya fue apartado, por lo que tampoco debe descontarse nuevamente del cash disponible informado.',
      `- Total órdenes: ${pendingOrders.totalOrders}`,
      `- Total reservado ARS: ${this.formatMoney(pendingOrders.totalReservedARS, 'ARS')}`,
      `- Tratamiento de cash: ${pendingOrders.cashTreatment}`,
      `- Incluidas en posiciones actuales: ${pendingOrders.includedInCurrentPositions ? 'Si' : 'No'}`,
      `- Incluidas en cash disponible: ${pendingOrders.includedInAvailableCash ? 'Si' : 'No'}`,
      '',
      '### Detalle',
      this.tableFromRows(pendingOrders.orders, [
        { header: 'Especie', key: 'symbol' },
        { header: 'Cantidad', key: 'quantity' },
        { header: 'Precio límite ARS', key: 'limitPriceARS' },
        { header: 'Reservado ARS', key: 'reservedAmountARS' }
      ]),
      '',
      '### Resumen por especie',
      this.tableFromRows(pendingOrders.summaryBySymbol, [
        { header: 'Especie', key: 'symbol' },
        { header: 'Cantidad total', key: 'totalQuantity' },
        { header: 'Reservado ARS', key: 'totalReservedARS' },
        { header: 'Precio promedio límite ARS', key: 'averageLimitPriceARS' },
        { header: 'Órdenes', key: 'ordersCount' }
      ]),
      '',
      `- Aclaración GPT: ${pendingOrders.gptInstruction}`
    ];

    return lines.join('\n');
  }

  private movementAdjustmentsMarkdown(exportData: GptPortfolioExport): string {
    if (!exportData.movementAdjustments.length) {
      return '';
    }
    return ['## Movimientos de inversión aplicados', this.tableFromRows(exportData.movementAdjustments, [
      { header: 'Especie', key: 'especie' },
      { header: 'Moneda', key: 'moneda' },
      { header: 'Rentas cobradas', key: 'rentasCobradas' },
      { header: 'Amortizaciones cobradas', key: 'amortizacionesCobradas' },
      { header: 'Resultado sin ajuste', key: 'resultadoSinAjuste' },
      { header: 'Resultado ajustado', key: 'resultadoAjustado' },
      { header: 'Resultado ajustado %', key: 'resultadoAjustadoPercent' },
      { header: 'Nota', key: 'nota' }
    ])].join('\n');
  }

  private activatedAlertRows(exportData: GptPortfolioExport): Array<{
    especie: string;
    condicion: string;
    precioActual: string;
    precioObjetivo: string;
    distanciaPercent: string;
    notas: string;
  }> {
    const rows = [
      ...exportData.alerts.manual
        .filter((row) => String(row.estadoCalculado ?? '').toLowerCase() === 'activada')
        .map((row) => ({
          especie: row.especie,
          condicion: row.condicion ?? 'Manual',
          precioActual: row.precioActual,
          precioObjetivo: row.precioObjetivo ?? 'N/D',
          distanciaPercent: row.distanciaPercent,
          notas: row.notas ?? row.estadoOriginal ?? 'Manual'
        })),
      ...exportData.opportunities.activatedAlerts.items.map((item) => ({
        especie: item.symbol,
        condicion: item.condition ?? this.groupLabel(item.group),
        precioActual: this.formatMoney(item.currentPrice, 'ARS'),
        precioObjetivo: this.formatMoney(item.targetPrice, 'ARS'),
        distanciaPercent: this.formatPercent(item.distancePercent),
        notas: item.note ?? item.status
      }))
    ];

    return this.uniqueByKey(rows, (row) => row.especie.toUpperCase());
  }

  private activatedAlertSymbols(exportData: GptPortfolioExport): string[] {
    return this.uniqueStrings(this.activatedAlertRows(exportData).map((row) => row.especie));
  }

  private nearAlertSymbols(exportData: GptPortfolioExport): string[] {
    return this.uniqueStrings(
      exportData.alerts.manual
        .filter((row) => String(row.estadoCalculado ?? '').toLowerCase() === 'cerca')
        .map((row) => row.especie)
    );
  }

  private limitRows<T>(rows: T[], limit: number): T[] {
    return rows.slice(0, limit);
  }

  private groupLabel(group: string): string {
    switch (group) {
      case 'manual':
        return 'Manual';
      case 'calculated':
        return 'Calculada';
      default:
        return group;
    }
  }

  private operationsMarkdown(operationsBySymbol: Record<string, TableRow[]>): string {
    const sections: string[] = [];
    for (const [symbol, rows] of Object.entries(operationsBySymbol)) {
      sections.push(`### ${symbol}`, '');
      if (!rows.length) {
        sections.push('Sin operaciones.', '');
        continue;
      }
      sections.push(this.tableFromRows(rows, [
        { header: 'ID', key: 'id' },
        { header: 'Fecha', key: 'fecha' },
        { header: 'Moneda', key: 'moneda' },
        { header: 'Cantidad', key: 'cantidad' },
        { header: 'Precio compra', key: 'precioCompra' },
        { header: 'Total invertido', key: 'totalInvertido' },
        { header: 'Precio actual', key: 'precioActual' },
        { header: 'Valor actual', key: 'valorActual' },
        { header: 'Resultado $', key: 'resultadoMonto' },
        { header: 'Resultado %', key: 'resultadoPercent' }
      ]), '');
    }
    return sections.join('\n');
  }

  private manualAlertsMarkdown(rows: ExportAlertRow[]): string {
    if (!rows.length) {
      return '## Alertas manuales\n\nSin datos.';
    }
    return ['## Alertas manuales', this.tableFromRows(rows, [
      { header: 'Especie', key: 'especie' },
      { header: 'Condicion', key: 'condicion' },
      { header: 'Precio actual', key: 'precioActual' },
      { header: 'Precio objetivo', key: 'precioObjetivo' },
      { header: 'Distancia %', key: 'distanciaPercent' },
      { header: 'Estado calculado', key: 'estadoCalculado' },
      { header: 'Estado original', key: 'estadoOriginal' },
      { header: 'Observacion', key: 'observacion' },
      { header: 'Notas', key: 'notas' }
    ])].join('\n');
  }

  private calculatedAlertsMarkdown(rows: ExportAlertRow[]): string {
    if (!rows.length) {
      return '## Alertas calculadas\n\nSin datos.';
    }
    return ['## Alertas calculadas', this.tableFromRows(rows, [
      { header: 'Tipo alerta', key: 'tipoAlerta' },
      { header: 'Especie', key: 'especie' },
      { header: 'Fecha', key: 'fecha' },
      { header: 'Precio actual', key: 'precioActual' },
      { header: 'Objetivo', key: 'objetivo' },
      { header: 'Alerta', key: 'alerta' },
      { header: 'Distancia %', key: 'distanciaPercent' },
      { header: 'Observacion', key: 'observacion' }
    ])].join('\n');
  }

  private signalsMarkdown(title: string, rows: ExportSignalRow[]): string {
    if (!rows.length) {
      return `## ${title}\n\nSin señales.`;
    }
    return [`## ${title}`, this.tableFromRows(rows, [
      { header: 'Especie', key: 'especie' },
      { header: 'Tipo señal', key: 'tipoSenal' },
      { header: 'Periodo', key: 'periodo' },
      { header: 'Fecha inicio', key: 'fechaInicio' },
      { header: 'Precio inicio', key: 'precioInicio' },
      { header: 'Fecha fin', key: 'fechaFin' },
      { header: 'Precio fin', key: 'precioFin' },
      { header: 'Variacion %', key: 'variacionPercent' },
      { header: 'Observacion', key: 'observacion' }
    ])].join('\n');
  }

  private excludedSignalsMarkdown(rows: Array<{ especie: string; motivo: string }>): string {
    if (!rows.length) {
      return '';
    }
    return ['## Señales excluidas o dudosas', this.tableFromRows(rows, [
      { header: 'Especie', key: 'especie' },
      { header: 'Motivo', key: 'motivo' }
    ])].join('\n');
  }

  private concentrationMarkdown(concentration: ExportConcentration): string {
    const lines = ['## Concentracion'];
    if (concentration.currencyWarning) {
      lines.push(`> ${concentration.currencyWarning}`, '');
    }
    lines.push(this.table(['Metrica', 'Actual', 'Referencia', 'Estado'], [
      ['Top 1', this.formatPercent(concentration.top1Percent), '20%', this.concentrationState(concentration.top1Percent, 20)],
      ['Top 3', this.formatPercent(concentration.top3Percent), '45%', this.concentrationState(concentration.top3Percent, 45)],
      ['Top 5', this.formatPercent(concentration.top5Percent), '60%', this.concentrationState(concentration.top5Percent, 60)],
      ['Top 10', this.formatPercent(concentration.top10Percent), '80%', this.concentrationState(concentration.top10Percent, 80)]
    ]), '');
    lines.push('### Ranking principal');
    lines.push(this.tableFromRows(concentration.ranking, [
      { header: '#', key: 'rank' },
      { header: 'Especie', key: 'symbol' },
      { header: 'Moneda', key: 'currency' },
      { header: 'Tipo activo', key: 'assetType' },
      { header: 'Sector', key: 'sector' },
      { header: 'Total actual', key: 'totalCurrentValue' },
      { header: 'Peso %', key: 'weightPercent' },
      { header: 'Acum. %', key: 'cumulativeWeightPercent' }
    ]));
    return lines.join('\n');
  }

  private distributionMarkdown(distributions: GptPortfolioExport['distributions'], options: GptPortfolioExportOptions): string {
    const sections = [
      '## Distribucion del portafolio',
      this.distributionSectionMarkdown('Distribucion por moneda', distributions.moneda),
      this.distributionSectionMarkdown('Distribucion por tipo de activo', distributions.tipoActivo),
      this.distributionSectionMarkdown('Distribucion por sector', distributions.sector),
      this.distributionSectionMarkdown('Distribucion por region', distributions.region),
      this.distributionSectionMarkdown('Top 10 especies', distributions.especiesTop10, false)
    ];

    if (options.mode === 'full') {
      sections.splice(4, 0, this.distributionSectionMarkdown('Distribucion por subsector', distributions.subsector));
    }

    return sections.join('\n');
  }

  private insightsMarkdown(insights: GptPortfolioExport['decisionInsights']): string {
    const lines = ['## Insights del frontend'];
    lines.push(`- Semaforo: ${insights.semaforo}`);
    lines.push(`- Motivo: ${insights.motivo}`);
    for (const action of insights.acciones) {
      lines.push(`- Accion sugerida: ${action.title}`);
      lines.push(`  - ${action.note}`);
    }
    if (insights.mejorPosicion) {
      lines.push(`- Mejor posicion: ${insights.mejorPosicion.symbol}`);
      lines.push(`  - Resultado efectivo: ${insights.mejorPosicion.resultPercent}`);
      lines.push(`  - Valor actual: ${insights.mejorPosicion.currentValue}`);
      if (insights.mejorPosicion.note) {
        lines.push(`  - Nota: ${insights.mejorPosicion.note}`);
      }
    }
    if (insights.peorPosicion) {
      lines.push(`- Peor posicion: ${insights.peorPosicion.symbol}`);
      lines.push(`  - Resultado efectivo: ${insights.peorPosicion.resultPercent}`);
      lines.push(`  - Valor actual: ${insights.peorPosicion.currentValue}`);
      if (insights.peorPosicion.note) {
        lines.push(`  - Nota: ${insights.peorPosicion.note}`);
      }
    }
    lines.push(`- Mayor concentracion por tipo de activo: ${insights.mayorConcentracion}`);
    return lines.join('\n');
  }

  private dataReviewMarkdown(rows: ExportDataReviewItem[]): string {
    if (!rows.length) {
      return '## Datos a revisar antes de analizar\n\nSin hallazgos detectados por el frontend.';
    }
    return ['## Datos a revisar antes de analizar', this.tableFromRows(rows, [
      { header: 'Severidad', key: 'severidad' },
      { header: 'Fuente', key: 'fuente' },
      { header: 'Especie', key: 'especie' },
      { header: 'Problema', key: 'problema' },
      { header: 'Sugerencia', key: 'sugerencia' }
    ])].join('\n');
  }

  private historyMarkdown(monthlySummary: Array<TableRow>, annualSummary: Array<TableRow>, options: GptPortfolioExportOptions): string {
    const monthlyRows = options.includeMonthlyHistory ? this.monthlyRowsForMode(monthlySummary, options) : [];
    return [
      '## Historial mensual y anual',
      '### Mensual',
      monthlyRows.length ? this.tableFromRows(monthlyRows, [
        { header: 'Mes', key: 'mes' },
        { header: 'Valor inicio', key: 'valorInicio' },
        { header: 'Compras', key: 'compras' },
        { header: 'Ventas', key: 'ventas' },
        { header: 'Valor fin', key: 'valorFin' },
        { header: 'Resultado', key: 'resultado' },
        { header: 'Variacion %', key: 'variacionPercent' },
        { header: 'Inflacion %', key: 'inflacionPercent' },
        { header: 'Rendimiento real %', key: 'rendimientoRealPercent' },
        { header: 'Rendimiento real acum %', key: 'rendimientoRealAcumPercent' },
        { header: 'Ratio aporte', key: 'ratioAporte' },
        { header: 'Observacion', key: 'observacion' }
      ]) : 'Historial mensual desactivado o sin datos.',
      '',
      '### Anual',
      annualSummary.length ? this.tableFromRows(annualSummary, [
        { header: 'Anio', key: 'anio' },
        { header: 'Valor inicio', key: 'valorInicio' },
        { header: 'Compras', key: 'compras' },
        { header: 'Ventas', key: 'ventas' },
        { header: 'Valor fin', key: 'valorFin' },
        { header: 'Resultado', key: 'resultado' },
        { header: 'Rendimiento %', key: 'rendimientoPercent' },
        { header: 'Inflacion', key: 'inflacion' },
        { header: 'Rendimiento real', key: 'rendimientoReal' },
        { header: 'Ratio aporte', key: 'ratioAporte' }
      ]) : 'Sin datos anuales.'
    ].join('\n');
  }

  private monthlyRowsForMode(monthlySummary: Array<TableRow>, options: GptPortfolioExportOptions): Array<TableRow> {
    const ordered = [...monthlySummary].sort((a, b) => this.monthKey(String(a['mes'] ?? '')) - this.monthKey(String(b['mes'] ?? '')));
    if (options.mode === 'full') {
      return ordered;
    }

    const recent = ordered.slice(-3);
    const atypical = ordered.filter((row) => String(row['observacion'] ?? 'OK') !== 'OK');
    return this.uniqueByKey([...atypical, ...recent], (row) => String(row['mes'] ?? '')).sort(
      (a, b) => this.monthKey(String(a['mes'] ?? '')) - this.monthKey(String(b['mes'] ?? ''))
    );
  }

  private splitMarkdown(strategicSplit: GptPortfolioExport['strategicSplit']): string {
    if (!strategicSplit) {
      return '## Split estrategico\n\nSin split estrategico.';
    }
    const lines = ['## Split estrategico'];
    if (strategicSplit.warning) {
      lines.push('Tabla35 detectada, pero la escala parece inconsistente con el valor total del portafolio.');
      lines.push('No usar estos montos para decisiones hasta revisar el Excel.');
      lines.push('');
    }
    lines.push('Nota: los porcentajes se calculan como promedio entre ARS y USD, sin convertir monedas.');
    lines.push(`- % Jubilacion: ${strategicSplit.jubilacionPercent ?? 'N/D'}`);
    lines.push(`- % Ahorro: ${strategicSplit.ahorroPercent ?? 'N/D'}`);
    lines.push(`- Desvio vs 50/50: ${strategicSplit.desvioPercent ?? 'N/D'}`);
    if (!strategicSplit.warning) {
      lines.push(`- Monto jubilacion ARS: ${strategicSplit.montoJubilacionARS ?? 'N/D'}`);
      lines.push(`- Monto ahorro ARS: ${strategicSplit.montoAhorroARS ?? 'N/D'}`);
      lines.push(`- Monto jubilacion USD: ${strategicSplit.montoJubilacionUSD ?? 'N/D'}`);
      lines.push(`- Monto ahorro USD: ${strategicSplit.montoAhorroUSD ?? 'N/D'}`);
    }
    return lines.join('\n');
  }

  private recentMovementsMarkdown(recentMovements: ExportRecentMovements): string {
    const lines = ['## Movimientos recientes detectados en el Excel'];
    const cashLines = [
      recentMovements.manualContext.cashArs !== null ? `ARS ${this.formatMoney(recentMovements.manualContext.cashArs, 'ARS')}` : null,
      recentMovements.manualContext.cashUsd !== null ? `USD ${this.formatMoney(recentMovements.manualContext.cashUsd, 'USD')}` : null
    ].filter(Boolean) as string[];
    lines.push(
      `- Rango analizado: ${recentMovements.rangeLabel}`,
      `- Preset: ${recentMovements.rangePresetLabel}`,
      `- Referencia: ${recentMovements.referenceDate}`,
      `- Desde: ${recentMovements.startDate}`,
      `- Cash disponible informado: ${cashLines.length ? cashLines.join(' | ') : 'No informado'}`,
      `- Compras brutas: ${recentMovements.summaryByCurrency.map((item) => `${item.currency} ${item.purchasesGross}`).join(' | ') || 'N/D'}`,
      `- Ventas brutas: ${recentMovements.summaryByCurrency.map((item) => `${item.currency} ${item.salesGross}`).join(' | ') || 'N/D'}`,
      `- Flujo operativo detectado (ventas - compras): ${recentMovements.summaryByCurrency.map((item) => `${item.currency} ${item.operatingFlow}`).join(' | ') || 'N/D'}`,
      `- Conteo compras: ${recentMovements.summaryByCurrency.map((item) => `${item.currency} ${item.purchaseCount}`).join(' | ') || 'N/D'}`,
      `- Conteo ventas: ${recentMovements.summaryByCurrency.map((item) => `${item.currency} ${item.saleCount}`).join(' | ') || 'N/D'}`,
      '- Nota: el flujo operativo no necesariamente representa aporte neto.'
    );

    if (recentMovements.summaryByCurrency.length) {
      lines.push(
        '',
        this.tableFromRows(recentMovements.summaryByCurrency, [
          { header: 'Moneda', key: 'currency' },
          { header: 'Compras brutas', key: 'purchasesGross' },
          { header: 'Ventas brutas', key: 'salesGross' },
          { header: 'Flujo operativo', key: 'operatingFlow' },
          { header: 'Conteo compras', key: 'purchaseCount' },
          { header: 'Conteo ventas', key: 'saleCount' }
        ])
      );
    }

    if (recentMovements.newPositions.length) {
      lines.push(
        '',
        '### Nuevas posiciones recientes detectadas desde Tabla6',
        this.tableFromRows(recentMovements.newPositions, [
          { header: 'Especie', key: 'symbol' },
          { header: 'Moneda', key: 'currency' },
          { header: 'Primera compra', key: 'firstPurchaseDate' },
          { header: 'Compras en periodo', key: 'purchasesInPeriod' },
          { header: 'Compras brutas', key: 'purchasesGross' },
          { header: 'Nota', key: 'note' }
        ])
      );
    }

    if (recentMovements.closedPositions.length) {
      lines.push(
        '',
        '### Posibles posiciones cerradas',
        this.tableFromRows(recentMovements.closedPositions, [
          { header: 'Especie', key: 'symbol' },
          { header: 'Moneda', key: 'currency' },
          { header: 'Fecha venta', key: 'saleDate' },
          { header: 'Fecha compra', key: 'buyDate' },
          { header: 'Nota', key: 'note' }
        ])
      );
    }

    if (recentMovements.recentPurchases.length) {
      lines.push(
        '',
        '### Compras recientes dentro del rango seleccionado',
        this.tableFromRows(recentMovements.recentPurchases, [
          { header: 'Especie', key: 'symbol' },
          { header: 'Moneda', key: 'currency' },
          { header: 'Fecha', key: 'date' },
          { header: 'Cantidad', key: 'quantity' },
          { header: 'Monto', key: 'amount' },
          { header: 'Nota', key: 'note' }
        ])
      );
    }

    if (recentMovements.recentSales.length) {
      lines.push(
        '',
        '### Ventas recientes dentro del rango seleccionado',
        this.tableFromRows(recentMovements.recentSales, [
          { header: 'Especie', key: 'symbol' },
          { header: 'Moneda', key: 'currency' },
          { header: 'Fecha', key: 'date' },
          { header: 'Cantidad', key: 'quantity' },
          { header: 'Monto', key: 'amount' },
          { header: 'Nota', key: 'note' }
        ])
      );
    }

    return lines.join('\n');
  }

  private simulationMarkdown(simulation: ExportSimulation): string {
    return ['## Simulacion / escenario actual', this.tableFromRows([simulation], [
      { header: 'Moneda', key: 'moneda' },
      { header: 'Aporte mensual', key: 'aporteMensual' },
      { header: 'Meses', key: 'meses' },
      { header: 'Rendimiento anual esperado %', key: 'rendimientoAnualEsperadoPercent' },
      { header: 'Valor proyectado', key: 'valorProyectado' },
      { header: 'Ganancia estimada', key: 'gananciaEstimada' },
      { header: 'Aclaracion', key: 'aclaracion' }
    ])].join('\n');
  }

  private weeklyFocus(exportData: GptPortfolioExport): string[] {
    const focus: string[] = [];
    const activatedAlerts = this.activatedAlertSymbols(exportData);
    const benchmarkSummary = exportData.benchmarkMinimum.summary;
    const cashParts = [
      exportData.recentMovements.manualContext.cashArs !== null ? `ARS ${this.formatMoney(exportData.recentMovements.manualContext.cashArs, 'ARS')}` : null,
      exportData.recentMovements.manualContext.cashUsd !== null ? `USD ${this.formatMoney(exportData.recentMovements.manualContext.cashUsd, 'USD')}` : null
    ].filter(Boolean) as string[];
    const liquidity = exportData.recentMovements.summaryByCurrency
      .map((item) => `${item.currency}: compras ${item.purchasesGross}, ventas ${item.salesGross}, flujo ${item.operatingFlow}`)
      .join(' | ');
    focus.push(`Liquidez operativa reciente: ${cashParts.length ? `${cashParts.join(' | ')}; ` : ''}${liquidity || 'N/D'}.`);

    const newPositions = exportData.recentMovements.newPositions.slice(0, 3).map((item) => item.symbol).filter(Boolean);
    const closedPositions = exportData.recentMovements.closedPositions.slice(0, 3).map((item) => item.symbol).filter(Boolean);
    const movementParts: string[] = [];
    if (newPositions.length) {
      movementParts.push(`nuevas posiciones ${newPositions.join(', ')}`);
    }
    if (closedPositions.length) {
      movementParts.push(`posibles cierres ${closedPositions.join(', ')}`);
    }
    focus.push(`Movimientos recientes: ${movementParts.length ? movementParts.join('; ') : 'sin cambios relevantes detectados.'}`);

    const importantReview = this.dataReviewHighlights(exportData.dataReview);
    focus.push(`Datos a revisar: ${importantReview || 'No hay hallazgos destacados.'}`);

    if (benchmarkSummary?.balanceVsMinimumArs !== null && benchmarkSummary?.balanceVsMinimumPercentArs !== null) {
      const safeBenchmarkSummary = benchmarkSummary!;
      focus.push(`Benchmark mínimo ARS: balance ${safeBenchmarkSummary.balanceVsMinimumArs}, ${safeBenchmarkSummary.balanceVsMinimumPercentArs}.`);
    }

    if (exportData.benchmarkMinimum.positionsBelowMinimum.length) {
      focus.push(`Peores posiciones bajo benchmark mínimo: ${exportData.benchmarkMinimum.positionsBelowMinimum.slice(0, 5).map((item) => item.especie).join(', ')}.`);
    }

    if (activatedAlerts.length) {
      focus.push(`Alertas activadas: ${activatedAlerts.slice(0, 5).join(', ')}.`);
    } else {
      const nearAlerts = this.uniqueStrings(this.nearAlertSymbols(exportData));
      if (nearAlerts.length) {
        focus.push(`Alertas cercanas: ${nearAlerts.slice(0, 6).join(', ')}.`);
      }
    }

    const caidas30 = this.uniqueStrings(this.signalSymbols(exportData.alerts.signals30D, 'caida'));
    if (caidas30.length) {
      focus.push(`Caidas 30D: ${caidas30.slice(0, 6).join(', ')}.`);
    }
    const recuperaciones30 = this.uniqueStrings(this.signalSymbols(exportData.alerts.signals30D, 'recuperacion'));
    if (recuperaciones30.length) {
      focus.push(`Recuperaciones 30D: ${recuperaciones30.slice(0, 6).join(', ')}.`);
    }
    if (exportData.decisionInsights.mejorPosicion) {
      focus.push(`Ganancia fuerte a vigilar: ${exportData.decisionInsights.mejorPosicion.symbol} con ${exportData.decisionInsights.mejorPosicion.resultPercent}.`);
    }

    return this.uniqueByKey(focus, (item) => item.toLowerCase()).slice(0, 8);
  }

  private distributionSectionMarkdown(
    title: string,
    rows: Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies?: number }>,
    includeCount = true
  ): string {
    if (!rows.length) {
      return `### ${title}\n\nSin datos.`;
    }
    const columns = [
      { header: title.includes('especies') ? 'Especie' : title.includes('moneda') ? 'Moneda' : 'Categoria', key: 'categoria' },
      { header: 'Monto', key: 'monto' },
      { header: 'Peso %', key: 'pesoPercent' }
    ];
    if (includeCount) {
      columns.push({ header: 'Cantidad especies', key: 'cantidadEspecies' });
    }
    return [`### ${title}`, this.tableFromRows(rows as TableRow[], columns)].join('\n');
  }

  private alertSymbolsFromManual(rows: ExportAlertRow[]): string[] {
    return this.uniqueStrings(rows
      .filter((row) => row.observacion === 'Cercana' || row.observacion === 'Activada')
      .slice(0, 10)
      .map((row) => row.especie)
      .filter(Boolean));
  }

  private signalSymbols(rows: ExportSignalRow[], type?: string): string[] {
    return this.uniqueStrings(rows
      .filter((row) => !type || String(row.tipoSenal).toLowerCase().includes(type))
      .slice(0, 10)
      .map((row) => row.especie)
      .filter(Boolean));
  }

  private dataReviewHighlights(rows: ExportDataReviewItem[]): string {
    const important = this.uniqueByKey(
      rows.filter((row) => ['critical', 'warning'].includes(String(row.severidad).toLowerCase())),
      (row) => `${row.especie.toLowerCase()}|${row.problema.toLowerCase()}`
    );
    if (!important.length) {
      return '';
    }
    return important
      .slice(0, 2)
      .map((row) => `${row.especie}: ${row.problema}`)
      .join(' | ');
  }

  private uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
  }

  private uniqueByKey<T>(items: T[], keySelector: (item: T) => string): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
      const key = keySelector(item);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  private isFciOrLiquidityPosition(position: PortfolioPosition): boolean {
    const assetType = String(position.assetType ?? '').toUpperCase();
    const positionType = String(position.positionType ?? '').toUpperCase();
    return assetType.includes('FCI') || assetType.includes('MONEY MARKET') || positionType.includes('LIQUID');
  }

  private isCryptoPosition(position: PortfolioPosition): boolean {
    const assetType = String(position.assetType ?? '').toUpperCase();
    const positionType = String(position.positionType ?? '').toUpperCase();
    const sector = String(position.sector ?? '').toUpperCase();
    return assetType.includes('CRYPTO') || positionType.includes('CRYPTO') || sector.includes('CRYPTO');
  }

  private concentrationState(current: number, reference: number): string {
    if (current <= reference) return 'OK';
    if (current <= reference + 10) return 'Revisar';
    return 'Revisar alto';
  }

  private manualStatus(condition: string | null | undefined, target: number | null | undefined, current: number | null | undefined, fallback: string | null | undefined): string {
    if (!condition && fallback) {
      return fallback;
    }
    if (target === null || target === undefined || current === null || current === undefined) {
      return 'inactiva';
    }
    const normalizedCondition = String(condition ?? '').toLowerCase();
    const distance = this.distancePercent(target, current);
    const near = distance !== null && Math.abs(distance) <= 5;
    const activated = normalizedCondition.includes('debajo') ? current <= target : normalizedCondition.includes('supera') ? current >= target : false;
    if (activated) return 'activada';
    if (near) return 'cerca';
    return 'lejos';
  }

  private manualRank(status: string): string {
    const order: Record<string, string> = { activada: 'a', cerca: 'b', lejos: 'c', inactiva: 'd' };
    return order[status] ?? 'z';
  }

  private operationResult(operation: InvestmentOperation, current: PortfolioPosition | null): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const currentValue = operation.currentValue ?? current?.currentValue ?? null;
    if (invested === null || currentValue === null) {
      return null;
    }
    return currentValue - invested;
  }

  private operationResultPercent(operation: InvestmentOperation, current: PortfolioPosition | null): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const result = this.operationResult(operation, current);
    if (invested === null || invested === 0 || result === null) {
      return null;
    }
    return (result / invested) * 100;
  }

  private normalizeMonthLabel(value: string): string {
    const parsed = parseExcelDate(value);
    if (parsed) {
      return this.formatDate(parsed);
    }
    const serial = Number(value);
    if (Number.isFinite(serial)) {
      const parsedSerial = parseExcelDate(serial);
      if (parsedSerial) {
        return this.formatDate(parsedSerial);
      }
    }
    return value;
  }

  private monthKey(value: string | null | undefined): number {
    if (!value) return 0;
    const parsed = parseExcelDate(value);
    return parsed ? parsed.getTime() : Number(value) || 0;
  }

  private instructions(): string[] {
    return [];
  }

  private normalizeCurrency(currency: string | null | undefined): 'ARS' | 'USD' {
    const value = String(currency ?? '').trim().toUpperCase();
    if (value === 'USD' || value === 'US') return 'USD';
    return 'ARS';
  }

  private formatMoney(value: number | null | undefined, currency: string): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    const symbol = this.normalizeCurrency(currency) === 'USD' ? 'US$' : '$';
    return `${symbol} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  }

  private formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    return `${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
  }

  private formatNumber(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }

  private maskOrFormatMoney(value: number | null | undefined, currency: string, options: GptPortfolioExportOptions): string {
    return options.maskSensitive ? '****' : this.formatMoney(value, currency);
  }

  private maskOrFormatPercent(value: number | null | undefined, options: GptPortfolioExportOptions): string {
    return options.maskSensitive ? '****' : this.formatPercent(value);
  }

  private maskOrFormatNumber(value: number | null | undefined, options: GptPortfolioExportOptions, digits = 2): string {
    return options.maskSensitive ? '****' : this.formatNumber(value, digits);
  }

  private formatDate(value: string | Date | null | undefined): string {
    const date = parseExcelDate(value);
    if (!date) {
      return 'N/D';
    }
    return `${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${date.getUTCFullYear()}`;
  }

  private formatDateTime(value: Date): string {
    return `${this.formatDate(value)} ${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }

  private dateValue(value: string | Date | null | undefined): number {
    const date = parseExcelDate(value);
    return date ? date.getTime() : 0;
  }

  private distancePercent(target: number | null | undefined, current: number | null | undefined): number | null {
    if (target === null || target === undefined || current === null || current === undefined || target === 0) {
      return null;
    }
    return ((current - target) / target) * 100;
  }

  private percent(value: number, total: number): number {
    return total > 0 ? (value / total) * 100 : 0;
  }

  private table(headers: string[], rows: string[][]): string {
    const headerLine = `| ${headers.join(' | ')} |`;
    const separator = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
    return [headerLine, separator, body].join('\n');
  }

  private tableFromRows(rows: TableRow[], columns: Array<{ header: string; key: string }>): string {
    const headers = columns.map((column) => column.header);
    const mapped = rows.map((row) => columns.map((column) => String(row[column.key] ?? 'N/D')));
    return this.table(headers, mapped);
  }

  private observationForManualAlert(distance: number | null, status: string): string {
    if (distance !== null && Math.abs(distance) > 80) {
      return 'Posible error de escala';
    }
    if (status === 'activada') {
      return 'Activada';
    }
    if (status === 'cerca') {
      return 'Cercana';
    }
    return 'OK';
  }
}

