import { Injectable } from '@angular/core';
import { CurrencyMapperService, CanonicalCurrency } from '../../../core/services/currency-mapper.service';
import { PortfolioCalculatorService } from '../../../core/services/portfolio-calculator.service';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { parseExcelDate } from '../../../core/utils/value-parsing.utils';
import { MovementDateRange, MovementDateRangeService } from './movement-date-range.service';
import { PerformanceReferenceBundle, PerformanceReferenceService } from './performance-reference.service';
import { WeeklyManualContext } from './gpt-portfolio-export.service';

export type SimulationRateMode = 'manual' | 'real12m' | 'nominal12m' | 'realYtd' | 'nominalYtd' | 'real3m' | 'conservative';

export interface LiquidityCard {
  title: string;
  value: string;
  note: string;
}

export interface MovementCurrencySummary {
  currency: CanonicalCurrency;
  purchasesGross: string;
  salesGross: string;
  operatingFlow: string;
  purchaseCount: number;
  saleCount: number;
}

export interface RecentMovementRow {
  date: string;
  symbol: string;
  currency: string;
  quantity: string;
  amount: string;
  note: string;
  resultPercent?: string;
}

export interface RecentMovementsSection {
  movementDateRange: MovementDateRange;
  rangeLabel: string;
  rangePresetLabel: string;
  referenceDate: string;
  startDate: string;
  summaryByCurrency: MovementCurrencySummary[];
  recentPurchases: RecentMovementRow[];
  recentSales: RecentMovementRow[];
  newPositions: RecentMovementRow[];
  closedPositions: RecentMovementRow[];
  morePurchases: number;
  moreSales: number;
}

interface SimulationSeriesPoint {
  label: string;
  date?: string;
  value: number;
}

interface SelectedRateReference {
  label: string;
  ratePercent: number | null;
  source: string;
  period: string | null;
  monthsUsed: number | null;
  annualized: boolean;
  warning: string | null;
}

export interface SimulationSection {
  rateMode: SimulationRateMode;
  rateLabel: string;
  rateSource: string;
  ratePeriod: string | null;
  rateMonthsUsed: number | null;
  rateAnnualized: boolean;
  rateWarning: string | null;
  baseCurrency: CanonicalCurrency;
  ratePercent: number | null;
  referenceRealLabel: string | null;
  nominalCurrentValue: string;
  nominalAportes: string;
  nominalFutureValue: string;
  nominalGain: string;
  realFutureValue: string | null;
  realGain: string | null;
  warning: string;
  points: SimulationSeriesPoint[];
}

export interface DecisionDashboardSection {
  liquidityCards: LiquidityCard[];
  movements: RecentMovementsSection;
  performance: PerformanceReferenceBundle;
  simulation: SimulationSection;
}

@Injectable({ providedIn: 'root' })
export class DecisionDashboardService {
  constructor(
    private readonly calculator: PortfolioCalculatorService,
    private readonly performanceReference: PerformanceReferenceService,
    private readonly movementDateRangeService: MovementDateRangeService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  build(
    snapshot: PortfolioAppState,
    manualContext: WeeklyManualContext,
    movementDateRange: MovementDateRange,
    currencyScope: 'ALL' | 'ARS' | 'USD',
    simulationCurrency: 'ARS' | 'USD',
    monthlyContribution: number,
    months: number,
    rateMode: SimulationRateMode,
    manualAnnualReturnPercent: number
  ): DecisionDashboardSection {
    const positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    const performance = this.performanceReference.build(snapshot.dataset?.monthlySummary ?? [], snapshot.dataset?.monthlyPerformance ?? []);
    const liquidityCards = this.buildLiquidityCards(positions, manualContext);
    const movements = this.buildMovements(snapshot, positions, movementDateRange);
    const simulation = this.buildSimulation(
      snapshot,
      positions,
      performance,
      currencyScope,
      simulationCurrency,
      monthlyContribution,
      months,
      rateMode,
      manualAnnualReturnPercent
    );

    return {
      liquidityCards,
      movements,
      performance,
      simulation
    };
  }

  private buildLiquidityCards(positions: ReturnType<PortfolioCalculatorService['enrichPositions']>, manualContext: WeeklyManualContext): LiquidityCard[] {
    const cashArs = typeof manualContext.cashArs === 'number' ? manualContext.cashArs : null;
    const cashUsd = typeof manualContext.cashUsd === 'number' ? manualContext.cashUsd : null;
    const fciArs = positions
      .filter((position) => this.isLiquidityLike(position) && this.normalizeCurrency(position.currency) === 'ARS')
      .reduce((sum, position) => sum + Number(position.currentValue ?? 0), 0);
    const fciUsd = positions
      .filter((position) => this.isLiquidityLike(position) && this.normalizeCurrency(position.currency) === 'USD')
      .reduce((sum, position) => sum + Number(position.currentValue ?? 0), 0);

    const totalArs = (cashArs ?? 0) + fciArs;
    const totalUsd = (cashUsd ?? 0) + fciUsd;

    return [
      {
        title: 'Cash ARS informado',
        value: this.currencyMapper.formatCurrency(cashArs, 'ARS'),
        note: 'Monto manual informado por el usuario'
      },
      {
        title: 'Cash USD informado',
        value: this.currencyMapper.formatCurrency(cashUsd, 'USD'),
        note: 'Monto manual informado por el usuario'
      },
      {
        title: 'FCI / Money Market ARS detectado',
        value: this.currencyMapper.formatCurrency(fciArs, 'ARS'),
        note: 'No necesariamente libre para operar'
      },
      {
        title: 'FCI / Money Market USD detectado',
        value: this.currencyMapper.formatCurrency(fciUsd, 'USD'),
        note: 'No necesariamente libre para operar'
      },
      {
        title: 'Liquidez total visible ARS',
        value: this.currencyMapper.formatCurrency(totalArs, 'ARS'),
        note: 'Cash + FCI / Money Market detectado'
      },
      {
        title: 'Liquidez total visible USD',
        value: this.currencyMapper.formatCurrency(totalUsd, 'USD'),
        note: 'Cash + FCI / Money Market detectado'
      }
    ];
  }

  private buildMovements(
    snapshot: PortfolioAppState,
    positions: ReturnType<PortfolioCalculatorService['enrichPositions']>,
    movementDateRange: MovementDateRange
  ): RecentMovementsSection {
    const normalizedRange = this.movementDateRangeService.normalizeForSnapshot(movementDateRange, snapshot);
    const parsedRange = this.movementDateRangeService.parseMovementRange(normalizedRange);
    const operations = snapshot.dataset?.operations ?? [];
    const sales = snapshot.dataset?.sales ?? [];
    const bounds = this.movementDateRangeService.availableBounds(snapshot);
    const referenceDate = parsedRange.to ?? bounds.to ?? new Date();
    const startDate = parsedRange.from ?? bounds.from ?? referenceDate;
    const windowStart = startDate.getTime();
    const windowEnd = referenceDate.getTime();
    const operationRows = operations
      .map((item) => ({
        date: this.parseDate(item.date),
        symbol: item.symbol,
        currency: this.normalizeCurrency(item.currency),
        quantity: item.quantity ?? 0,
        amount: this.movementAmount(item.total ?? item.amount ?? item.currentValue ?? null, item.quantity, item.buyPrice),
        resultPercent: this.resultPercentForSymbol(positions, item.symbol),
        source: item
      }))
      .filter((item): item is typeof item & { date: Date } => item.date !== null && item.date.getTime() >= windowStart && item.date.getTime() <= windowEnd)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const saleRows = sales
      .map((item) => ({
        date: this.parseDate(item.sellDate ?? item.buyDate),
        symbol: item.symbol,
        currency: this.normalizeCurrency(item.currency),
        quantity: item.quantity ?? 0,
        amount: this.movementAmount(item.total ?? item.amount ?? item.currentValue ?? null, item.quantity, item.sellPrice ?? item.buyPrice),
        resultPercent: this.percentageOrNda(item.variation),
        source: item
      }))
      .filter((item): item is typeof item & { date: Date } => item.date !== null && item.date.getTime() >= windowStart && item.date.getTime() <= windowEnd)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const currencies: CanonicalCurrency[] = ['ARS', 'USD'];
    const summaryByCurrency = currencies.map((currency) => {
      const purchases = operationRows.filter((row) => row.currency === currency);
      const salesInCurrency = saleRows.filter((row) => row.currency === currency);
      const purchasesGross = purchases.reduce((sum, row) => sum + row.amount, 0);
      const salesGross = salesInCurrency.reduce((sum, row) => sum + row.amount, 0);
      return {
        currency,
        purchasesGross: this.currencyMapper.formatCurrency(purchasesGross, currency),
        salesGross: this.currencyMapper.formatCurrency(salesGross, currency),
        operatingFlow: this.currencyMapper.formatCurrency(salesGross - purchasesGross, currency),
        purchaseCount: purchases.length,
        saleCount: salesInCurrency.length
      };
    });

    const recentPurchases = operationRows.slice(0, 8).map((row) => ({
      date: this.formatDate(row.date),
      symbol: row.symbol,
      currency: row.currency,
      quantity: this.currencyMapper.formatNumber(row.quantity),
      amount: this.currencyMapper.formatCurrency(row.amount, row.currency),
      note: 'Compra detectada',
      resultPercent: this.currencyMapper.formatPercentage(row.resultPercent)
    }));

    const recentSales = saleRows.slice(0, 8).map((row) => ({
      date: this.formatDate(row.date),
      symbol: row.symbol,
      currency: row.currency,
      quantity: this.currencyMapper.formatNumber(row.quantity),
      amount: this.currencyMapper.formatCurrency(row.amount, row.currency),
      note: 'Venta detectada',
      resultPercent: row.resultPercent
    }));

    const firstPurchaseBySymbol = new Map<string, Date>();
    for (const row of operations) {
      const date = this.parseDate(row.date);
      if (!date) {
        continue;
      }
      const key = row.symbol.toUpperCase();
      const current = firstPurchaseBySymbol.get(key);
      if (!current || date.getTime() < current.getTime()) {
        firstPurchaseBySymbol.set(key, date);
      }
    }

    const newPositions = Array.from(firstPurchaseBySymbol.entries())
      .filter(([, date]) => date.getTime() >= windowStart && date.getTime() <= windowEnd)
      .slice(0, 8)
      .map(([symbol, date]) => {
        const position = positions.find((item) => item.symbol.toUpperCase() === symbol) ?? null;
        return {
          date: this.formatDate(date),
          symbol,
          currency: position ? this.normalizeCurrency(position.currency) : 'ARS',
          quantity: position ? this.currencyMapper.formatNumber(position.quantity) : 'N/D',
          amount: position ? this.currencyMapper.formatCurrency(position.currentValue, position.currency) : 'N/D',
          note: 'Primera compra dentro del período',
          resultPercent: position ? this.currencyMapper.formatPercentage(position.resultPercent) : 'N/D'
        };
      });

    const soldSymbols = new Set(saleRows.map((item) => item.symbol.toUpperCase()));
    const openSymbols = new Set(positions.map((item) => item.symbol.toUpperCase()));
    const closedPositions = saleRows
      .filter((item) => !openSymbols.has(item.symbol.toUpperCase()) || this.isCaucion(item.symbol))
      .slice(0, 8)
      .map((item) => ({
        date: this.formatDate(item.date),
        symbol: item.symbol,
        currency: this.normalizeCurrency(item.currency),
        quantity: this.currencyMapper.formatNumber(item.quantity),
        amount: this.currencyMapper.formatCurrency(item.amount, item.currency),
        note: this.isCaucion(item.symbol)
          ? 'Instrumento operativo de caución / liquidez'
          : soldSymbols.has(item.symbol.toUpperCase())
            ? 'Posible posición cerrada'
            : 'Venta detectada',
        resultPercent: item.resultPercent
      }));

    return {
      movementDateRange: normalizedRange,
      rangeLabel: this.movementDateRangeService.formatRangeLabel(normalizedRange),
      rangePresetLabel: this.movementDateRangeService.labelForPreset(normalizedRange.preset),
      referenceDate: this.formatDate(referenceDate),
      startDate: this.formatDate(startDate),
      summaryByCurrency,
      recentPurchases,
      recentSales,
      newPositions,
      closedPositions,
      morePurchases: Math.max(0, operationRows.length - 8),
      moreSales: Math.max(0, saleRows.length - 8)
    };
  }

  private buildSimulation(
    snapshot: PortfolioAppState,
    positions: ReturnType<PortfolioCalculatorService['enrichPositions']>,
    performance: PerformanceReferenceBundle,
    currencyScope: 'ALL' | 'ARS' | 'USD',
    simulationCurrency: 'ARS' | 'USD',
    monthlyContribution: number,
    months: number,
    rateMode: SimulationRateMode,
    manualAnnualReturnPercent: number
  ): SimulationSection {
    const currentValue = positions
      .filter((position) => this.normalizeCurrency(position.currency) === simulationCurrency)
      .reduce((sum, position) => sum + Number(position.currentValue ?? 0), 0);
    const selected = this.selectReference(performance, rateMode, manualAnnualReturnPercent);
    const nominalRate = selected.ratePercent;
    const rateWarning = selected.warning ?? (nominalRate !== null && nominalRate < 0 ? 'La tasa usada es negativa. El escenario es defensivo, no una predicción.' : null);
    const realReference = performance.references.find((reference) => reference.type === 'real' && reference.period === '12M' && reference.annualRatePercent !== null)
      ?? performance.references.find((reference) => reference.type === 'real' && reference.period === 'YTD' && reference.annualRatePercent !== null)
      ?? null;
    const realRate = realReference?.annualRatePercent ?? null;
    const nominalProjection = this.project(currentValue, monthlyContribution, months, nominalRate);
    const realProjection = realRate !== null ? this.project(currentValue, monthlyContribution, months, realRate) : null;

    return {
      rateMode,
      rateLabel: selected.label,
      rateSource: selected.source,
      ratePeriod: selected.period,
      rateMonthsUsed: selected.monthsUsed,
      rateAnnualized: selected.annualized,
      rateWarning,
      baseCurrency: simulationCurrency,
      ratePercent: nominalRate,
      referenceRealLabel: realReference?.label ?? null,
      nominalCurrentValue: this.currencyMapper.formatCurrency(currentValue, simulationCurrency),
      nominalAportes: this.currencyMapper.formatCurrency(Math.max(0, monthlyContribution) * Math.max(0, months), simulationCurrency),
      nominalFutureValue: this.currencyMapper.formatCurrency(nominalProjection.futureValue, simulationCurrency),
      nominalGain: this.currencyMapper.formatCurrency(nominalProjection.gain, simulationCurrency),
      realFutureValue: realProjection ? this.currencyMapper.formatCurrency(realProjection.futureValue, simulationCurrency) : null,
      realGain: realProjection ? this.currencyMapper.formatCurrency(realProjection.gain, simulationCurrency) : null,
      warning: [
        'La proyección es un escenario basado en datos históricos cargados. No es una predicción ni garantía.',
        rateWarning
      ].filter((part): part is string => !!part).join(' '),
      points: nominalProjection.points
    };
  }

  private selectReference(performance: PerformanceReferenceBundle, rateMode: SimulationRateMode, manualAnnualReturnPercent: number): SelectedRateReference {
    if (rateMode === 'manual') {
      return {
        label: 'Manual',
        ratePercent: manualAnnualReturnPercent,
        source: 'Edición manual',
        period: 'manual',
        monthsUsed: null,
        annualized: false,
        warning: null
      };
    }

    const lookup: Record<Exclude<SimulationRateMode, 'manual' | 'conservative'>, { type: 'nominal' | 'real'; period: '12M' | 'YTD' | '3M' }> = {
      real12m: { type: 'real', period: '12M' },
      nominal12m: { type: 'nominal', period: '12M' },
      realYtd: { type: 'real', period: 'YTD' },
      nominalYtd: { type: 'nominal', period: 'YTD' },
      real3m: { type: 'real', period: '3M' }
    };

    if (rateMode === 'conservative') {
      const base = performance.references.find((reference) => reference.type === 'real' && reference.period === '12M' && reference.annualRatePercent !== null)
        ?? performance.references.find((reference) => reference.type === 'real' && reference.period === 'YTD' && reference.annualRatePercent !== null)
        ?? performance.references.find((reference) => reference.type === 'nominal' && reference.period === '12M' && reference.annualRatePercent !== null)
        ?? null;
      const conservative = base?.annualRatePercent !== null && base?.annualRatePercent !== undefined
        ? base.annualRatePercent / 2
        : 0;
      return {
        label: `Conservador (${base?.label ?? 'referencia histórica'})`,
        ratePercent: conservative,
        source: base ? `${base.source} · 50% de referencia` : 'Regla conservadora',
        period: base?.period ?? 'manual',
        monthsUsed: base?.monthsUsed ?? null,
        annualized: base?.period !== 'YTD' && base?.period !== 'manual',
        warning: base?.warning ?? null
      };
    }

    const selection = lookup[rateMode];
    const found = performance.references.find((reference) => reference.type === selection.type && reference.period === selection.period && reference.annualRatePercent !== null) ?? null;
    if (found) {
      return {
        label: found.label,
        ratePercent: found.annualRatePercent,
        source: found.source,
        period: found.period,
        monthsUsed: found.monthsUsed,
        annualized: found.period !== 'YTD',
        warning: found.warning ?? null
      };
    }

    return {
      label: 'Manual',
      ratePercent: manualAnnualReturnPercent,
      source: 'Fallback manual',
      period: 'manual',
      monthsUsed: null,
      annualized: false,
      warning: null
    };
  }

  private project(currentValue: number, monthlyContribution: number, months: number, annualRatePercent: number | null): { futureValue: number; gain: number; points: SimulationSeriesPoint[] } {
    const safeMonths = Math.max(0, Math.floor(months));
    const safeContribution = Math.max(0, monthlyContribution);
    const monthlyRate = annualRatePercent !== null && Number.isFinite(annualRatePercent) ? annualRatePercent / 100 / 12 : 0;
    const points: SimulationSeriesPoint[] = [];
    const today = new Date();
    const baseDate = this.startOfUtcMonth(today);

    let value = currentValue;
    points.push({ label: 'Hoy', date: this.toIsoDate(today), value });
    for (let index = 0; index < safeMonths; index += 1) {
      value = (value + safeContribution) * (1 + monthlyRate);
      const projectedDate = this.addUtcMonths(baseDate, index + 1);
      points.push({ label: this.formatProjectionLabel(projectedDate), date: this.toIsoDate(projectedDate), value });
    }

    const invested = currentValue + safeContribution * safeMonths;
    return {
      futureValue: value,
      gain: value - invested,
      points
    };
  }

  private startOfUtcMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private addUtcMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  }

  private formatProjectionLabel(date: Date): string {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = monthNames[date.getUTCMonth()] ?? '';
    const year = String(date.getUTCFullYear()).slice(-2);
    return `${month}-${year}`;
  }

  private toIsoDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resultPercentForSymbol(positions: ReturnType<PortfolioCalculatorService['enrichPositions']>, symbol: string): number | null {
    return positions.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase())?.resultPercent ?? null;
  }

  private movementAmount(total: number | null | undefined, quantity: number | null | undefined, price: number | null | undefined): number {
    if (typeof total === 'number' && Number.isFinite(total)) {
      return total;
    }
    const safeQuantity = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;
    const safePrice = typeof price === 'number' && Number.isFinite(price) ? price : null;
    if (safeQuantity !== null && safePrice !== null) {
      return safeQuantity * safePrice;
    }
    return 0;
  }

  private isLiquidityLike(position: { assetType?: string | null; subsector?: string | null; positionType?: string | null; symbol: string }): boolean {
    const combined = `${position.assetType ?? ''} ${position.subsector ?? ''} ${position.positionType ?? ''}`.toUpperCase();
    const symbol = String(position.symbol ?? '').toUpperCase();
    return combined.includes('FCI')
      || combined.includes('MONEY MARKET')
      || combined.includes('LIQUID')
      || ['IOLCAMA', 'PRPEDOB', 'IOLDOLD'].includes(symbol);
  }

  private isCaucion(symbol: string): boolean {
    return String(symbol ?? '').toUpperCase().includes('CAUC');
  }

  private normalizeCurrency(currency: string): CanonicalCurrency {
    const normalized = this.currencyMapper.normalizeCurrency(currency);
    return normalized === 'UNKNOWN' ? 'ARS' : normalized;
  }

  private parseDate(value: string | Date | null | undefined): Date | null {
    const parsed = parseExcelDate(value);
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  private formatDate(value: string | Date | null | undefined): string {
    const parsed = this.parseDate(value);
    if (!parsed) {
      return 'N/D';
    }
    return `${String(parsed.getUTCDate()).padStart(2, '0')}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${parsed.getUTCFullYear()}`;
  }

  private percentageOrNda(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }
}
