import { Injectable } from '@angular/core';
import { PortfolioCalculatorService } from '../../../core/services/portfolio-calculator.service';
import { PortfolioHealthService } from '../../../core/services/portfolio-health.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../../core/services/privacy-mode.service';
import { parseExcelDate } from '../../../core/utils/value-parsing.utils';
import {
  AnnualInvestmentSummary,
  DailyBalance,
  InvestmentOperation,
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
  resultadoMonto: string;
  resultadoPercent: string;
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
  positions: ExportPositionRow[];
  operationsBySymbol: Record<string, TableRow[]>;
  alerts: {
    manual: ExportAlertRow[];
    calculated: ExportAlertRow[];
    signals5D: ExportSignalRow[];
    signals30D: ExportSignalRow[];
    excludedSignals: Array<{ especie: string; motivo: string }>;
  };
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
    private readonly privacyMode: PrivacyModeService
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
      `- Archivo: ${data.metadata.sourceFile ?? 'N/D'}`,
      `- Estado: ${data.metadata.workbookStatus}`,
      `- Valor actual ARS: ${data.summary.ars.totalCurrentValue}`,
      `- Valor actual USD: ${data.summary.usd.totalCurrentValue}`,
      `- Semaforo: ${data.decisionInsights.semaforo}`,
      `- Peor posicion: ${data.decisionInsights.peorPosicion?.symbol ?? 'N/D'}`,
      `- Mejor posicion: ${data.decisionInsights.mejorPosicion?.symbol ?? 'N/D'}`
    ].join('\n');
  }

  private buildData(snapshot: PortfolioAppState, viewModel: DecisionViewModel, options: GptPortfolioExportOptions): GptPortfolioExport {
    const positions = snapshot.dataset?.positions ?? [];
    const enrichedPositions = snapshot.dataset ? this.calculator.enrichPositions(positions, snapshot.dataset.classifications) : [];
    const totalPortfolioValue = enrichedPositions.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
    const healthReport = snapshot.dataset && snapshot.workbook ? this.healthService.buildReport(snapshot.dataset, snapshot.workbook.validation) : null;
    const latestBalance = this.computeLatestBalance(snapshot.dataset?.dailyBalances ?? []);
    const summary = this.buildSummary(enrichedPositions, latestBalance);
    const alertIndex = this.buildAlertIndex(snapshot, enrichedPositions);
    const alerts = this.buildAlerts(snapshot, enrichedPositions, alertIndex);
    const concentration = this.buildConcentration(enrichedPositions, options.currencyScope);
    const distributions = this.buildDistributions(enrichedPositions, options.currencyScope);
    const monthlySummary = this.buildMonthlySummary(snapshot.dataset?.monthlySummary ?? [], options);
    const annualSummary = this.buildAnnualSummary(snapshot.dataset?.annualSummary ?? []);
    const strategicSplit = this.buildStrategicSplit(snapshot.dataset?.strategicSplit ?? [], totalPortfolioValue);
    const simulation = this.buildSimulation(viewModel, options);
    const decisionInsights = this.buildDecisionInsights(viewModel, enrichedPositions, concentration, alerts);
    const dataReview = this.buildDataReview(viewModel, healthReport?.findings ?? [], alerts, strategicSplit, monthlySummary, simulation, snapshot);
    const operationsBySymbol = this.buildOperationsBySymbol(snapshot.dataset?.operations ?? [], enrichedPositions, options);

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
      instructions: this.instructions(),
      summary,
      positions: this.buildPositions(enrichedPositions, options, alertIndex),
      operationsBySymbol,
      alerts,
      concentration,
      distributions,
      decisionInsights,
      dataReview,
      monthlySummary,
      annualSummary,
      strategicSplit,
      simulation
    };
  }

  private buildSummary(positions: PortfolioPosition[], latestBalance: LatestBalanceDigest): GptPortfolioExport['summary'] {
    return {
      general: this.summaryForScope(positions, 'ALL'),
      ars: this.summaryForScope(positions, 'ARS'),
      usd: this.summaryForScope(positions, 'USD'),
      latestBalance,
      warning: 'Este total mezcla ARS y USD sin convertir. Usar solo como referencia visual.'
    };
  }

  private summaryForScope(positions: PortfolioPosition[], scope: ExportCurrencyScope): ExportSummaryScope {
    const filtered = scope === 'ALL'
      ? positions
      : positions.filter((position) => this.normalizeCurrency(position.currency) === scope);

    const totalCurrentValue = filtered.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
    const totalInvested = filtered.reduce((sum, position) => sum + (position.totalInvested ?? 0), 0);
    const totalResult = totalCurrentValue - totalInvested;
    const totalResultPercent = totalInvested > 0 ? (totalResult / totalInvested) * 100 : null;
    const speciesCount = new Set(filtered.map((position) => position.symbol)).size;
    const bestPosition = [...filtered].sort((a, b) => (b.resultPercent ?? -Infinity) - (a.resultPercent ?? -Infinity))[0] ?? null;
    const worstPosition = [...filtered].sort((a, b) => (a.resultPercent ?? Infinity) - (b.resultPercent ?? Infinity))[0] ?? null;
    const formattedCurrency = scope === 'ALL' ? 'ARS' : scope;

    return {
      currency: scope === 'ALL' ? null : scope,
      totalCurrentValue: filtered.length ? this.formatMoney(totalCurrentValue, formattedCurrency) : 'N/D',
      totalInvested: filtered.length ? this.formatMoney(totalInvested, formattedCurrency) : 'N/D',
      totalResult: filtered.length ? this.formatMoney(totalResult, formattedCurrency) : 'N/D',
      totalResultPercent: filtered.length ? this.formatPercent(totalResultPercent) : 'N/D',
      speciesCount,
      positionsCount: filtered.length,
      bestPosition: bestPosition ? this.digestPosition(bestPosition) : null,
      worstPosition: worstPosition ? this.digestPosition(worstPosition) : null
    };
  }

  private digestPosition(position: PortfolioPosition): ExportPositionDigest {
    return {
      symbol: position.symbol,
      currency: this.normalizeCurrency(position.currency),
      assetType: position.assetType ?? position.positionType ?? 'N/D',
      sector: position.sector ?? 'N/D',
      region: position.region ?? 'N/D',
      currentValue: this.formatMoney(position.currentValue, position.currency),
      resultPercent: this.formatPercent(position.resultPercent)
    };
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
    alertIndex: Map<string, { count: number; nearestDistance: number | null; nearestStatus: string; nearestNote: string | null; hasSuspiciousScale: boolean }>
  ): ExportPositionRow[] {
    const ordered = [...positions].sort((a, b) => {
      const currencyOrder = this.normalizeCurrency(a.currency).localeCompare(this.normalizeCurrency(b.currency));
      if (currencyOrder !== 0) return currencyOrder;
      return (b.portfolioWeight ?? 0) - (a.portfolioWeight ?? 0);
    });

    return ordered.map((position) => {
      const alert = alertIndex.get(position.symbol.toUpperCase()) ?? null;
      const status = this.positionStatus(position, alert);
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
        resultadoMonto: this.maskOrFormatMoney(position.resultAmount, position.currency, options),
        resultadoPercent: this.maskOrFormatPercent(position.resultPercent, options),
        pesoPercent: this.maskOrFormatPercent(position.portfolioWeight, options),
        alertas: alertLabel,
        estadoSemaforo: status.status,
        motivoSemaforo: status.reason
      };
    });
  }

  private positionStatus(
    position: PortfolioPosition,
    alert: { count: number; nearestDistance: number | null; nearestStatus: string; nearestNote: string | null; hasSuspiciousScale: boolean } | null
  ): { status: string; reason: string } {
    if (position.currentPrice === null || position.currentPrice === undefined || !position.classification) {
      return { status: 'Sin datos', reason: 'Falta historico, clasificacion o precio actual' };
    }
    if (alert?.hasSuspiciousScale) {
      return { status: 'Revisar alto', reason: 'Posible error de escala en alerta asociada' };
    }
    if ((position.resultPercent ?? 0) < -10) {
      return { status: 'Revisar alto', reason: `Resultado ${this.formatPercent(position.resultPercent)}` };
    }
    if ((alert?.nearestDistance !== null && Math.abs(alert?.nearestDistance ?? 0) <= 5) || (position.resultPercent ?? 0) < 0 || (position.portfolioWeight ?? 0) >= 5) {
      return { status: 'Revisar', reason: this.positionReviewReason(position, alert) };
    }
    return { status: 'OK', reason: `Resultado ${this.formatPercent(position.resultPercent)}` };
  }

  private positionReviewReason(
    position: PortfolioPosition,
    alert: { nearestDistance: number | null; nearestNote: string | null } | null
  ): string {
    if (alert?.nearestNote) {
      return `Alerta cercana: ${alert.nearestNote}`;
    }
    if ((position.resultPercent ?? 0) < 0) {
      return `Resultado ${this.formatPercent(position.resultPercent)}`;
    }
    if ((position.portfolioWeight ?? 0) >= 5) {
      return `Peso relevante ${this.formatPercent(position.portfolioWeight)}`;
    }
    return 'Revisar';
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

    return { visible5D, visible30D, excluded };
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
    const maxValueARS = Math.max(...ordered.map((item) => Number(item.valueARS ?? 0)));
    const maxValueUSD = Math.max(...ordered.map((item) => Number(item.valueUSD ?? 0)));
    const scaleIssue = totalPortfolioValue > 0 && maxValueARS > 0 && maxValueARS < totalPortfolioValue * 0.02 && maxValueUSD <= totalPortfolioValue * 0.02;

    return {
      fecha: this.formatDate(last.date),
      jubilacionPercent: this.formatPercent(last.retirementPercent),
      ahorroPercent: this.formatPercent(last.savingsPercent),
      desvioPercent: this.formatPercent(Math.abs((last.retirementPercent ?? 0) - 50)),
      montoJubilacionARS: scaleIssue ? 'N/D' : this.formatMoney(last.retirementAmountARS, 'ARS'),
      montoAhorroARS: scaleIssue ? 'N/D' : this.formatMoney(last.savingsAmountARS, 'ARS'),
      montoJubilacionUSD: scaleIssue ? 'N/D' : this.formatMoney(last.retirementAmountUSD, 'USD'),
      montoAhorroUSD: scaleIssue ? 'N/D' : this.formatMoney(last.savingsAmountUSD, 'USD'),
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

  private buildDecisionInsights(
    viewModel: DecisionViewModel,
    positions: PortfolioPosition[],
    concentration: ExportConcentration,
    alerts: GptPortfolioExport['alerts']
  ): GptPortfolioExport['decisionInsights'] {
    const orderedByResult = [...positions].sort((a, b) => (a.resultPercent ?? 0) - (b.resultPercent ?? 0));
    const bestByResult = [...positions].sort((a, b) => (b.resultPercent ?? 0) - (a.resultPercent ?? 0));
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
      peorPosicion: orderedByResult[0] ? this.digestPosition(orderedByResult[0]) : null,
      mejorPosicion: bestByResult[0] ? this.digestPosition(bestByResult[0]) : null,
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
    snapshot: PortfolioAppState
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

    return items;
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
    lines.push(`Archivo fuente: ${exportData.metadata.sourceFile ?? 'N/D'}`);
    lines.push(`Estado del workbook: ${exportData.metadata.workbookStatus}`);
    lines.push(`Tablas detectadas: ${exportData.metadata.tablesDetected.join(', ') || 'N/D'}`);
    lines.push(`Advertencias: ${exportData.metadata.warnings.length ? exportData.metadata.warnings.join(' | ') : 'Ninguna'}`);
    lines.push(`Errores: ${exportData.metadata.errors.length ? exportData.metadata.errors.join(' | ') : 'Ninguno'}`);
    lines.push('');
    lines.push('Este archivo fue generado automaticamente desde el frontend local.');
    lines.push('El Excel sigue siendo la fuente de verdad.');
    lines.push('No hay conversion automatica entre ARS y USD salvo que se indique explicitamente.');
    lines.push('');
    lines.push('## Instrucciones para el analisis', ...this.instructions().map((line) => `- ${line}`), '');
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
    lines.push(this.positionsMarkdown(exportData.positions));
    lines.push('');

    if (options.mode === 'full' || options.includeFullPurchases) {
      lines.push('## Compras y lotes individuales', this.operationsMarkdown(exportData.operationsBySymbol), '');
    } else {
      lines.push('## Compras y lotes individuales', 'Modo resumido: se omiten lotes extensos. Revisa la exportacion completa para el detalle total.', '');
    }

    lines.push(this.manualAlertsMarkdown(exportData.alerts.manual), '');
    lines.push(this.calculatedAlertsMarkdown(exportData.alerts.calculated), '');

    if (options.includeSignals) {
      lines.push(this.signalsMarkdown('Señales 5D', exportData.alerts.signals5D), '');
      lines.push(this.signalsMarkdown('Señales 30D', exportData.alerts.signals30D), '');
      if (exportData.alerts.excludedSignals.length) {
        lines.push(this.excludedSignalsMarkdown(exportData.alerts.excludedSignals), '');
      }
    }

    lines.push(this.concentrationMarkdown(exportData.concentration), '');
    lines.push(this.distributionMarkdown(exportData.distributions), '');
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

    lines.push('', '## Preguntas sugeridas para analizar');
    this.questions().forEach((question, index) => lines.push(`${index + 1}. ${question}`));
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
      `- Principales posiciones por peso: ${exportData.concentration.ranking.slice(0, 5).map((item) => item.symbol).join(', ') || 'N/D'}`,
      `- Mayor concentracion por tipo de activo: ${exportData.concentration.largestAssetType?.label ?? 'N/D'}`,
      `- Mayor sector: ${exportData.concentration.largestSector?.label ?? 'N/D'}`,
      `- Mayor region: ${exportData.concentration.largestRegion?.label ?? 'N/D'}`,
      `- Alertas cercanas: ${this.alertSymbolsFromManual(exportData.alerts.manual).join(', ') || 'N/D'}`,
      `- Peor posicion: ${exportData.decisionInsights.peorPosicion?.symbol ?? 'N/D'}`,
      `- Mejor posicion: ${exportData.decisionInsights.mejorPosicion?.symbol ?? 'N/D'}`,
      `- Señales 30D de caida: ${this.signalSymbols(exportData.alerts.signals30D).join(', ') || 'N/D'}`,
      `- Datos a revisar: ${exportData.dataReview.length ? 'Si' : 'No detectados por el frontend'}`
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
      '## Balance diario',
      `- Ultimo balance: ${latest.currentValue ?? 'N/D'}`,
      `- Fecha ultimo balance: ${latest.currentDate ?? 'N/D'}`,
      `- Balance anterior: ${latest.previousValue ?? 'N/D'}`,
      `- Variacion ultimo dia: ${latest.delta ?? 'N/D'}`,
      `- Variacion ultimo dia %: ${latest.deltaPercent ?? 'N/D'}`,
      `- Mejor balance diario: ${latest.bestValue ?? 'N/D'}`,
      `- Fecha mejor balance: ${latest.bestDate ?? 'N/D'}`,
      `- Peor balance diario: ${latest.worstValue ?? 'N/D'}`,
      `- Fecha peor balance: ${latest.worstDate ?? 'N/D'}`
    ].join('\n');
  }

  private positionsMarkdown(rows: ExportPositionRow[]): string {
    if (!rows.length) {
      return '## Posiciones actuales\n\nNo hay posiciones.';
    }
    return ['## Posiciones actuales', this.tableFromRows(rows, [
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
      { header: 'Resultado $', key: 'resultadoMonto' },
      { header: 'Resultado %', key: 'resultadoPercent' },
      { header: 'Peso %', key: 'pesoPercent' },
      { header: 'Alertas', key: 'alertas' },
      { header: 'Estado semaforo', key: 'estadoSemaforo' },
      { header: 'Motivo semaforo', key: 'motivoSemaforo' }
    ])].join('\n');
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

  private distributionMarkdown(distributions: GptPortfolioExport['distributions']): string {
    return [
      '## Distribucion del portafolio',
      this.distributionSectionMarkdown('Distribucion por moneda', distributions.moneda),
      this.distributionSectionMarkdown('Distribucion por tipo de activo', distributions.tipoActivo),
      this.distributionSectionMarkdown('Distribucion por sector', distributions.sector),
      this.distributionSectionMarkdown('Distribucion por subsector', distributions.subsector),
      this.distributionSectionMarkdown('Distribucion por region', distributions.region),
      this.distributionSectionMarkdown('Top 10 especies', distributions.especiesTop10)
    ].join('\n');
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
      lines.push(`  - Resultado: ${insights.mejorPosicion.resultPercent}`);
      lines.push(`  - Valor actual: ${insights.mejorPosicion.currentValue}`);
    }
    if (insights.peorPosicion) {
      lines.push(`- Peor posicion: ${insights.peorPosicion.symbol}`);
      lines.push(`  - Resultado: ${insights.peorPosicion.resultPercent}`);
      lines.push(`  - Valor actual: ${insights.peorPosicion.currentValue}`);
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
    const monthlyRows = monthlySummary.slice(0, options.mode === 'full' ? monthlySummary.length : 12);
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
      ]) : 'Sin datos mensuales.',
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
    if (exportData.decisionInsights.peorPosicion) {
      focus.push(`Revisar ${exportData.decisionInsights.peorPosicion.symbol} por resultado negativo.`);
    }
    if (exportData.decisionInsights.mejorPosicion) {
      focus.push(`Vigilar ${exportData.decisionInsights.mejorPosicion.symbol} por ganancia acumulada alta.`);
    }
    const nearAlerts = this.alertSymbolsFromManual(exportData.alerts.manual);
    if (nearAlerts.length) {
      focus.push(`Revisar alertas cercanas: ${nearAlerts.slice(0, 6).join(', ')}`);
    }
    const caidas30 = this.signalSymbols(exportData.alerts.signals30D, 'caida');
    if (caidas30.length) {
      focus.push(`Revisar señales 30D de caida en ${caidas30.join(', ')}`);
    }
    if (exportData.concentration.currencyWarning) {
      focus.push('No mezclar ARS y USD en conclusiones generales.');
    }
    if (exportData.alerts.excludedSignals.length) {
      focus.push('Confirmar si los FCI/VALORIZADO deben excluirse de señales técnicas.');
    }
    return focus.slice(0, 8);
  }

  private distributionSectionMarkdown(
    title: string,
    rows: Array<{ categoria: string; monto: string; pesoPercent: string; cantidadEspecies?: number }>
  ): string {
    if (!rows.length) {
      return `### ${title}\n\nSin datos.`;
    }
    const columns = [
      { header: title.includes('especies') ? 'Especie' : title.includes('moneda') ? 'Moneda' : 'Categoria', key: 'categoria' },
      { header: 'Monto', key: 'monto' },
      { header: 'Peso %', key: 'pesoPercent' },
      { header: 'Cantidad especies', key: 'cantidadEspecies' }
    ];
    return [`### ${title}`, this.tableFromRows(rows as TableRow[], columns)].join('\n');
  }

  private alertSymbolsFromManual(rows: ExportAlertRow[]): string[] {
    return rows
      .filter((row) => row.observacion === 'Cercana' || row.observacion === 'Activada')
      .slice(0, 10)
      .map((row) => row.especie)
      .filter(Boolean);
  }

  private signalSymbols(rows: ExportSignalRow[], type?: string): string[] {
    return rows
      .filter((row) => !type || String(row.tipoSenal).toLowerCase().includes(type))
      .slice(0, 10)
      .map((row) => row.especie)
      .filter(Boolean);
  }

  private questions(): string[] {
    return [
      '¿Cuales son las posiciones que explican la mayor parte de la concentracion?',
      '¿Hay alertas cercanas o activadas que ameriten seguimiento?',
      '¿Que señales tecnicas parecen utiles y cuales conviene ignorar?',
      '¿El historial mensual muestra meses atipicos o inconsistencias?',
      '¿La simulacion actual sigue alineada con el plan de inversions?'
    ];
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
    return [
      'No asumir precios actuales externos si no se solicitan.',
      'No recomendar vender como primera opcion.',
      'Priorizar rebalanceo mediante nuevas compras.',
      'Separar analisis por moneda: ARS y USD.',
      'Marcar cuando una conclusion dependa de datos incompletos.',
      'Distinguir entre inversion de largo plazo/jubilacion y ahorro/mediano plazo.',
      'Usar las alertas manuales como referencia importante.',
      'No dar recomendaciones absolutas; proponer escenarios, prioridades y puntos a revisar.'
    ];
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
