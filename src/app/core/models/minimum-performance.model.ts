export type CalendarBenchmarkSource = 'TablaCalendario' | 'TablaCalendarioRem' | 'TablaCalendarioInf';

export interface CalendarBenchmarkRow {
  date: Date;
  tna: number | null;
  dailyReturnPercent: number | null;
  index: number | null;
  source: CalendarBenchmarkSource;
}

export type MinimumPerformanceStatus =
  | 'beats-minimum'
  | 'below-minimum'
  | 'missing-calendar'
  | 'not-applicable'
  | 'review';

export interface MinimumPerformanceLot {
  symbol: string;
  currency: string;
  buyDate: Date | null;
  quantity: number | null;
  investedAmount: number | null;
  currentValue: number | null;
  benchmarkStartIndex: number | null;
  benchmarkEndIndex: number | null;
  minimumExpectedValue: number | null;
  minimumExpectedReturnPercent: number | null;
  valueVsMinimumAmount: number | null;
  valueVsMinimumPercent: number | null;
  status: MinimumPerformanceStatus;
  notes: string[];
}

export interface MinimumPerformanceBySymbol {
  symbol: string;
  currency: string;
  lotsCount: number;
  investedAmount: number | null;
  currentValue: number | null;
  minimumExpectedValue: number | null;
  valueVsMinimumAmount: number | null;
  valueVsMinimumPercent: number | null;
  status: MinimumPerformanceStatus;
  lots: MinimumPerformanceLot[];
  notes: string[];
}

export type MinimumPerformanceSummaryStatus = 'positive' | 'negative' | 'neutral' | 'missing';

export interface MinimumPerformanceSummary {
  currency: 'ARS';
  comparableLotsCount: number;
  currentComparableArs: number | null;
  minimumExpectedArs: number | null;
  balanceVsMinimumArs: number | null;
  balanceVsMinimumPercentArs: number | null;
  status: MinimumPerformanceSummaryStatus;
  description: string;
  notes: string[];
}
