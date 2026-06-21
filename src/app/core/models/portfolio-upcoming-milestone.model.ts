export type UpcomingMilestoneCategory =
  | 'portfolio-value'
  | 'historical-recovery'
  | 'strategy-balance'
  | 'manual-goal';

export type UpcomingMilestoneStatus = 'pending' | 'reached' | 'not-available';

export interface PortfolioUpcomingMilestoneBreakdown {
  currency: 'ARS' | 'USD';
  retirementPercent: number | null;
  savingsPercent: number | null;
  gapPercent: number | null;
  retirementAmount?: number | null;
  savingsAmount?: number | null;
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
