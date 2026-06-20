export type UpcomingMilestoneCategory =
  | 'portfolio-value'
  | 'historical-recovery'
  | 'strategy-balance'
  | 'manual-goal';

export type UpcomingMilestoneStatus = 'pending' | 'reached' | 'not-available';

export interface PortfolioUpcomingMilestoneBreakdown {
  currency: 'ARS' | 'USD';
  currentPercent: number | null;
  targetPercent: number;
  gapPercent: number | null;
  currentAmount: number | null;
  targetAmount: number | null;
  remainingAmount: number | null;
  estimatedMonths: number | null;
}

export interface PortfolioUpcomingMilestone {
  id: string;
  title: string;
  description: string;
  category: UpcomingMilestoneCategory;
  status: UpcomingMilestoneStatus;
  currentValue: number | null;
  targetValue: number | null;
  remainingAmount: number | null;
  remainingPercent: number | null;
  currency: 'ARS' | 'USD' | null;
  monthlyContribution?: number | null;
  estimatedMonths?: number | null;
  breakdown?: PortfolioUpcomingMilestoneBreakdown[];
  source: string;
}
