import type { CanonicalCurrency } from '../services/currency-mapper.service';

export interface InvestmentMovement {
  date: Date | null;
  symbol: string;
  currency: CanonicalCurrency | 'UNKNOWN';
  type: string;
  amount: number | null;
  affectsPerformance: boolean;
  affectsInvestedCapital: boolean;
  capitalEffect: 'reduces-cost' | 'none' | 'unknown';
  note: string | null;
}

export interface InvestmentMovementSummary {
  symbol: string;
  currency: CanonicalCurrency | 'UNKNOWN';
  incomeAmount: number;
  capitalReturnedAmount: number;
  totalMovementsAmount: number;
  marketResultAmount: number;
  marketResultPercent: number | null;
  adjustedResultAmount: number;
  adjustedResultPercent: number | null;
  hasAdjustments: boolean;
  movementsCount: number;
  notes: string[];
}

export interface AppliedInvestmentMovement {
  date: Date | null;
  symbol: string;
  currency: CanonicalCurrency | 'UNKNOWN';
  type: string;
  amount: number;
  affectsPerformance: boolean;
  affectsInvestedCapital: boolean;
  capitalEffect: 'reduces-cost' | 'none' | 'unknown';
  note: string | null;
}

export interface InvestmentMovementLotAdjustment {
  operationId: string;
  symbol: string;
  currency: CanonicalCurrency | 'UNKNOWN';
  buyDate: Date | null;
  quantity: number | null;
  investedAmount: number | null;
  currentValue: number | null;
  marketResultAmount: number | null;
  marketResultPercent: number | null;
  incomeAmount: number;
  capitalReturnedAmount: number;
  adjustedResultAmount: number | null;
  adjustedResultPercent: number | null;
  movementsCount: number;
  movementIds: string[];
  appliedMovements: AppliedInvestmentMovement[];
  notes: string[];
}
