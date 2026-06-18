import type { CalendarBenchmarkRow } from './minimum-performance.model';
import type { InvestmentMovement } from './investment-movements.model';
export type { CalendarBenchmarkRow } from './minimum-performance.model';
export type { InvestmentMovement } from './investment-movements.model';

export interface InvestmentOperation {
  id: string;
  date: string | Date | null;
  symbol: string;
  currency: string;
  quantity: number | null;
  buyPrice: number | null;
  total: number | null;
  currentPrice: number | null;
  currentValue: number | null;
  variation: number | null;
  remVariation: number | null;
  remValue: number | null;
  amount: number | null;
  monthlyRate: number | null;
  annualRate: number | null;
  top: string | null;
  trend: string | null;
  sourceTable?: string;
}

export interface InvestmentSale {
  id: string;
  buyDate: string | Date | null;
  sellDate: string | Date | null;
  symbol: string;
  currency: string;
  quantity: number | null;
  buyPrice: number | null;
  total: number | null;
  sellPrice: number | null;
  currentValue: number | null;
  variation: number | null;
  amount: number | null;
  minimumObjective: number | null;
  sourceTable?: string;
}

export interface PortfolioPosition {
  symbol: string;
  currency: string;
  positionType: string;
  assetType: string | null;
  quantity: number;
  totalInvested: number;
  currentPrice: number | null;
  currentValue: number;
  resultAmount: number;
  resultPercent: number | null;
  averagePrice: number | null;
  portfolioWeight?: number;
  sector?: string | null;
  subsector?: string | null;
  region?: string | null;
  classification?: AssetClassification | null;
}

export interface HistoricalPrice {
  date: string | Date | null;
  month: string | null;
  symbol: string;
  price: number | null;
}

export interface DailyBalance {
  date: string | Date | null;
  month: string | null;
  balance: number | null;
}

export interface AssetClassification {
  symbol: string;
  currentValue: number | null;
  amount: number | null;
  expected: number | null;
  type: string | null;
  sector: string | null;
  subsector: string | null;
  region: string | null;
}

export interface ManualAlert {
  symbol: string;
  condition: string | null;
  targetPrice: number | null;
  notes: string | null;
  status: string | null;
}

export interface CalculatedAlert {
  symbol: string;
  date: string | Date | null;
  currentPrice: number | null;
  target: number | null;
  alert: string | null;
  sourceTable?: string;
}

export interface MarketSignal {
  symbol: string;
  startDate: string | Date | null;
  startPrice: number | null;
  endDate: string | Date | null;
  endPrice: number | null;
  variationPercent: number | null;
  period: '5D' | '30D' | string;
  signalType: 'caida' | 'recuperacion' | string;
}

export interface MonthlyInvestmentSummary {
  month: string;
  startValue: number | null;
  purchases: number | null;
  sales: number | null;
  endValue: number | null;
  result: number | null;
  variationPercent: number | null;
  inflationPercent: number | null;
  realReturnPercent: number | null;
  accumulatedRealReturnPercent: number | null;
  contributionRatio: number | null;
  goodMarket: string | null;
  goodContribution: string | null;
  monthType: string | null;
  year: number | null;
}

export interface AnnualInvestmentSummary {
  year: number | null;
  startValue: number | null;
  purchases: number | null;
  sales: number | null;
  endValue: number | null;
  result: number | null;
  returnPercent: number | null;
  inflation: number | null;
  realReturn: number | null;
  contributionRatio: number | null;
}

export interface MonthlyPerformanceRow {
  month: string;
  monthlyTotal: number | null;
  accumulated: number | null;
  startValue: number | null;
  variationPercent: number | null;
  realReturnPercent: number | null;
}

export interface StrategicSplit {
  date: string | Date | null;
  valueARS: number | null;
  valueUSD: number | null;
  retirementPercent: number | null;
  savingsPercent: number | null;
  retirementAmountARS: number | null;
  retirementAmountUSD: number | null;
  savingsAmountARS: number | null;
  savingsAmountUSD: number | null;
}

export interface PlatformDistribution {
  platform: string;
  amount: number | null;
  currency: string | null;
}

export interface PortfolioSummary {
  totalCurrentValue: number;
  totalInvested: number;
  totalResult: number;
  totalResultPercent: number;
  byCurrency: Array<{
    currency: string;
    totalCurrentValue: number;
    totalInvested: number;
    totalResult: number;
    totalResultPercent: number | null;
    speciesCount: number;
  }>;
  bestPosition: PortfolioPosition | null;
  worstPosition: PortfolioPosition | null;
  largestWeight: PortfolioPosition | null;
  speciesCount: number;
  latestBalance: number | null;
  latestBalanceDate: Date | string | null;
}

export interface PortfolioDataset {
  operations: InvestmentOperation[];
  sales: InvestmentSale[];
  investmentMovements: InvestmentMovement[];
  positions: PortfolioPosition[];
  historicalPrices: HistoricalPrice[];
  dailyBalances: DailyBalance[];
  classifications: AssetClassification[];
  manualAlerts: ManualAlert[];
  calculatedAlerts: CalculatedAlert[];
  signals: MarketSignal[];
  monthlySummary: MonthlyInvestmentSummary[];
  annualSummary: AnnualInvestmentSummary[];
  monthlyPerformance: MonthlyPerformanceRow[];
  strategicSplit: StrategicSplit[];
  platformDistribution: PlatformDistribution[];
  calendarBenchmarks: CalendarBenchmarkRow[];
}
