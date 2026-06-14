import { PortfolioPosition } from './portfolio.models';

export type ReviewSeverity = 'info' | 'warning' | 'critical';

export interface DataReviewFinding {
  category: string;
  severity: ReviewSeverity;
  symbol: string | null;
  currency: string | null;
  currentValue: number | null;
  problem: string;
  source: string;
  suggestion: string;
}

export interface DataHealthSummary {
  criticalProblems: number;
  warnings: number;
  uncategorizedAssets: number;
  assetsWithoutHistory: number;
  alertsToReview: number;
  incompleteSignals: number;
  strategicSplitIssues: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface DataReviewReport {
  summary: DataHealthSummary;
  findings: DataReviewFinding[];
}

export interface ConcentrationRankingItem {
  rank: number;
  symbol: string;
  currency: string;
  assetType: string | null;
  sector: string | null;
  subsector: string | null;
  region: string | null;
  totalCurrentValue: number;
  weightPercent: number;
  cumulativeWeightPercent: number;
}

export interface ConcentrationDimensionSummary {
  dimension: 'Especie' | 'Tipo de activo' | 'Sector' | 'Subsector' | 'Región';
  topLabel: string;
  topWeightPercent: number;
  top3Labels: string[];
  categoryCount: number;
}

export interface ConcentrationReport {
  currencyScope: 'ALL' | 'ARS' | 'USD';
  totalCurrentValue: number;
  top1Percent: number;
  top3Percent: number;
  top5Percent: number;
  top10Percent: number;
  largestPosition: PortfolioPosition | null;
  largestSector: ConcentrationDimensionSummary | null;
  largestSubsector: ConcentrationDimensionSummary | null;
  largestRegion: ConcentrationDimensionSummary | null;
  largestAssetType: ConcentrationDimensionSummary | null;
  ranking: ConcentrationRankingItem[];
  dimensionSummaries: ConcentrationDimensionSummary[];
  currencyWarning: string | null;
}

export interface PortfolioObjective {
  groupType: 'tramo' | 'tipo_activo' | 'sector' | 'subsector' | 'region' | string;
  groupName: string;
  targetPercent: number;
  currencyScope: 'ALL' | 'ARS' | 'USD' | null;
  notes: string | null;
}

