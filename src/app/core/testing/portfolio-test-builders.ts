import {
  AnnualInvestmentSummary,
  AssetClassification,
  CalculatedAlert,
  CalendarBenchmarkRow,
  DailyBalance,
  HistoricalPrice,
  InvestmentOperation,
  InvestmentSale,
  ManualAlert,
  MarketSignal,
  MonthlyInvestmentSummary,
  MonthlyPerformanceRow,
  PlatformDistribution,
  PortfolioDataset,
  PortfolioPosition,
  PortfolioSummary,
  StrategicSplit
} from '../models/portfolio.models';
import { PendingOrdersSummary } from '../models/pending-orders.model';
import { WorkbookSnapshot, WorkbookTableData, WorkbookValidationReport } from '../models/workbook.models';
import { PortfolioAppState } from '../services/portfolio-state.service';
import { CombinedAlert } from '../services/alert-mapper.service';
import { ChartPoint, SeriesPoint } from '../services/chart-data.service';

export function buildWorkbookTable(overrides: Partial<WorkbookTableData> & { rows?: Array<Record<string, unknown>> } = {}): WorkbookTableData {
  const rows = overrides.rows ?? [];
  return {
    name: 'TablaTest',
    displayName: 'TablaTest',
    sheetName: 'Hoja1',
    sheetIndex: 0,
    ref: 'A1',
    columns: [],
    rowCount: 0,
    ...overrides,
    rows
  };
}

export function buildWorkbookValidationReport(
  overrides: Partial<WorkbookValidationReport> = {}
): WorkbookValidationReport {
  return {
    fileName: 'Historial Sueldo.xlsm',
    sheetNames: [],
    detectedTables: [],
    findings: [],
    errors: [],
    warnings: [],
    invalidDates: [],
    invalidNumbers: [],
    currencyIssues: [],
    uncategorizedSymbols: [],
    symbolsWithoutHistory: [],
    symbolsWithoutCurrentPrice: [],
    ...overrides
  };
}

export function buildPortfolioPosition(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    symbol: 'AAA',
    currency: 'ARS',
    positionType: 'Sin clasificar',
    assetType: null,
    quantity: 1,
    totalInvested: 0,
    currentPrice: null,
    currentValue: 0,
    resultAmount: 0,
    resultPercent: 0,
    averagePrice: null,
    ...overrides
  };
}

export function buildInvestmentOperation(overrides: Partial<InvestmentOperation> = {}): InvestmentOperation {
  return {
    id: '1',
    date: '2025-01-01',
    symbol: 'AAA',
    currency: 'ARS',
    quantity: 1,
    buyPrice: 0,
    total: 0,
    currentPrice: null,
    currentValue: 0,
    variation: null,
    remVariation: null,
    remValue: null,
    amount: null,
    monthlyRate: null,
    annualRate: null,
    top: null,
    trend: null,
    ...overrides
  };
}

export function buildHistoricalPrice(overrides: Partial<HistoricalPrice> = {}): HistoricalPrice {
  return {
    date: '2025-01-01',
    month: 'ene-25',
    symbol: 'AAA',
    price: 1,
    ...overrides
  };
}

export function buildDailyBalance(overrides: Partial<DailyBalance> = {}): DailyBalance {
  return {
    date: '2025-01-01',
    month: 'ene-25',
    balance: 0,
    ...overrides
  };
}

export function buildClassification(overrides: Partial<AssetClassification> = {}): AssetClassification {
  return {
    symbol: 'AAA',
    currentValue: null,
    amount: null,
    expected: null,
    type: null,
    sector: null,
    subsector: null,
    region: null,
    ...overrides
  };
}

export function buildManualAlert(overrides: Partial<ManualAlert> = {}): ManualAlert {
  return {
    symbol: 'AAA',
    condition: null,
    targetPrice: null,
    notes: null,
    status: null,
    ...overrides
  };
}

export function buildCalculatedAlert(overrides: Partial<CalculatedAlert> = {}): CalculatedAlert {
  return {
    symbol: 'AAA',
    date: '2025-01-01',
    currentPrice: null,
    target: null,
    alert: null,
    sourceTable: 'TablaTest',
    ...overrides
  };
}

export function buildMarketSignal(overrides: Partial<MarketSignal> = {}): MarketSignal {
  return {
    symbol: 'AAA',
    startDate: '2025-01-01',
    startPrice: null,
    endDate: '2025-01-02',
    endPrice: null,
    variationPercent: null,
    period: '5D',
    signalType: 'caida',
    ...overrides
  };
}

export function buildMonthlySummary(overrides: Partial<MonthlyInvestmentSummary> = {}): MonthlyInvestmentSummary {
  return {
    month: 'ene-25',
    startValue: 0,
    purchases: 0,
    sales: 0,
    endValue: 0,
    result: 0,
    variationPercent: 0,
    inflationPercent: 0,
    realReturnPercent: 0,
    accumulatedRealReturnPercent: 0,
    contributionRatio: 0,
    goodMarket: null,
    goodContribution: null,
    monthType: null,
    year: 2025,
    ...overrides
  };
}

export function buildAnnualSummary(overrides: Partial<AnnualInvestmentSummary> = {}): AnnualInvestmentSummary {
  return {
    year: 2025,
    startValue: 0,
    purchases: 0,
    sales: 0,
    endValue: 0,
    result: 0,
    returnPercent: 0,
    inflation: 0,
    realReturn: 0,
    contributionRatio: 0,
    ...overrides
  };
}

export function buildMonthlyPerformanceRow(overrides: Partial<MonthlyPerformanceRow> = {}): MonthlyPerformanceRow {
  return {
    month: 'ene-25',
    monthlyTotal: 0,
    accumulated: 0,
    startValue: 0,
    variationPercent: 0,
    realReturnPercent: 0,
    ...overrides
  };
}

export function buildStrategicSplit(overrides: Partial<StrategicSplit> = {}): StrategicSplit {
  return {
    date: '2025-01-01',
    valueARS: 0,
    valueUSD: 0,
    retirementPercent: 50,
    savingsPercent: 50,
    retirementAmountARS: 0,
    retirementAmountUSD: 0,
    savingsAmountARS: 0,
    savingsAmountUSD: 0,
    ...overrides
  };
}

export function buildPlatformDistribution(overrides: Partial<PlatformDistribution> = {}): PlatformDistribution {
  return {
    platform: 'Plataforma',
    amount: 0,
    currency: 'ARS',
    ...overrides
  };
}

export function buildPortfolioDataset(overrides: Partial<PortfolioDataset> = {}): PortfolioDataset {
  return {
    operations: [],
    sales: [],
    investmentMovements: [],
    positions: [],
    historicalPrices: [],
    dailyBalances: [],
    classifications: [],
    manualAlerts: [],
    calculatedAlerts: [],
    signals: [],
    monthlySummary: [],
    annualSummary: [],
    monthlyPerformance: [],
    strategicSplit: [],
    platformDistribution: [],
    calendarBenchmarks: [],
    pendingOrders: {
      orders: [],
      summaryBySymbol: [],
      totalOrders: 0,
      totalReservedARS: 0,
      cashTreatment: 'reserved_not_available_cash',
      includedInCurrentPositions: false,
      includedInAvailableCash: false,
      warnings: []
    } satisfies PendingOrdersSummary,
    ...overrides
  };
}

export function buildWorkbookSnapshot(overrides: Partial<WorkbookSnapshot> = {}): WorkbookSnapshot {
  return {
    fileName: 'Historial Sueldo.xlsm',
    sheetNames: [],
    tables: [],
    validation: buildWorkbookValidationReport(),
    ...overrides
  };
}

export function buildPortfolioSummary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    totalCurrentValue: 0,
    totalInvested: 0,
    totalResult: 0,
    totalResultPercent: 0,
    byCurrency: [],
    bestPosition: null,
    worstPosition: null,
    largestWeight: null,
    speciesCount: 0,
    latestBalance: null,
    latestBalanceDate: null,
    ...overrides
  };
}

export function buildPortfolioAppState(overrides: Partial<PortfolioAppState> = {}): PortfolioAppState {
  return {
    status: 'ready',
    fileName: 'Historial Sueldo.xlsm',
    importedAt: '2026-06-20T00:00:00.000Z',
    workbook: buildWorkbookSnapshot(),
    dataset: buildPortfolioDataset(),
    summary: buildPortfolioSummary(),
    combinedAlerts: [] as CombinedAlert[],
    charts: {
      symbolDistribution: [] as ChartPoint[],
      currencyDistribution: [] as ChartPoint[],
      positionTypeDistribution: [] as ChartPoint[],
      assetTypeDistribution: [] as ChartPoint[],
      sectorDistribution: [] as ChartPoint[],
      subsectorDistribution: [] as ChartPoint[],
      regionDistribution: [] as ChartPoint[],
      balanceSeries: [] as SeriesPoint[],
      priceSeries: [] as SeriesPoint[]
    },
    validationErrors: [],
    validationWarnings: [],
    ...overrides
  };
}
