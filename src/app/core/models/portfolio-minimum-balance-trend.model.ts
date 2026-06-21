export type MinimumBalanceTrendStatus =
  | 'improving'
  | 'stable'
  | 'deteriorating'
  | 'not-available';

export interface MinimumBalanceTrendPoint {
  date: Date | string;
  comparableValueARS: number;
  minimumExpectedARS: number;
  balanceVsMinimumARS: number;
  balanceVsMinimumPercent: number | null;
}

export interface MinimumBalanceTrendSummary {
  currentBalanceVsMinimumARS: number | null;
  currentBalanceVsMinimumPercent: number | null;
  bestHistoricalBalanceARS: number | null;
  bestHistoricalDate: Date | string | null;
  worstHistoricalBalanceARS: number | null;
  worstHistoricalDate: Date | string | null;
  change30dARS: number | null;
  change30dPercentPoints: number | null;
  change90dARS: number | null;
  change90dPercentPoints: number | null;
  trendStatus: MinimumBalanceTrendStatus;
  trendLabel: string;
  positionsBelowMinimumCount: number;
  totalDeficitBelowMinimumARS: number;
  points: MinimumBalanceTrendPoint[];
  source: string;
  warnings: string[];
}
