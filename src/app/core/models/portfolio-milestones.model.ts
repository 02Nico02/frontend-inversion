export type PortfolioMilestoneCategory =
  | 'portfolio-value'
  | 'daily-balance'
  | 'monthly-performance'
  | 'real-performance'
  | 'benchmark-minimum'
  | 'contribution';

export type PortfolioMilestoneSeverity = 'positive' | 'negative' | 'neutral' | 'warning';

export type PortfolioMilestoneUnavailableReason = 'missing-data' | 'not-reached' | 'not-supported-yet';

export interface PortfolioMilestone {
  id: string;
  title: string;
  description: string;
  category: PortfolioMilestoneCategory;
  severity: PortfolioMilestoneSeverity;
  date: Date | string | null;
  value: number | null;
  percent: number | null;
  currency: 'ARS' | 'USD' | null;
  source: string;
}

export interface PortfolioUnavailableMilestone {
  id: string;
  title: string;
  category: PortfolioMilestoneCategory;
  reason: PortfolioMilestoneUnavailableReason;
  description: string;
  requiredSource?: string;
}

export interface PortfolioMilestoneBuildResult {
  detected: PortfolioMilestone[];
  unavailable: PortfolioUnavailableMilestone[];
}
