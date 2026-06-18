import { Injectable } from '@angular/core';
import { AppliedInvestmentMovement, InvestmentMovement, InvestmentMovementLotAdjustment, InvestmentMovementSummary } from '../models/investment-movements.model';
import { InvestmentOperation } from '../models/portfolio.models';
import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';
import { PortfolioAppState } from './portfolio-state.service';

interface AllocationBucket {
  incomeAmount: number;
  capitalReturnedAmount: number;
  totalMovementsAmount: number;
  movementsCount: number;
  movementIds: Set<string>;
  appliedMovements: AppliedInvestmentMovement[];
  notes: string[];
}

@Injectable({ providedIn: 'root' })
export class InvestmentMovementsPerformanceService {
  constructor(
    private readonly normalization: DataNormalizationService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  buildMovements(snapshot: PortfolioAppState): InvestmentMovement[] {
    const movements = snapshot.dataset?.investmentMovements ?? [];
    return movements
      .map((movement, index) => ({
        ...movement,
        date: movement.date ? this.normalization.asDate(movement.date) : null,
        symbol: this.normalization.normalizeSymbol(movement.symbol) ?? '',
        currency: this.currencyMapper.normalizeCurrency(movement.currency),
        type: this.normalization.asText(movement.type) ?? '',
        amount: this.normalization.asNumber(movement.amount),
        note: this.normalization.asText(movement.note),
        __index: index
      }))
      .filter((movement) => movement.symbol)
      .sort((a, b) => {
        const left = a.date?.getTime() ?? 0;
        const right = b.date?.getTime() ?? 0;
        if (left !== right) {
          return left - right;
        }
        const symbolDiff = a.symbol.localeCompare(b.symbol, 'es');
        if (symbolDiff !== 0) {
          return symbolDiff;
        }
        return a.__index - b.__index;
      })
      .map(({ __index: _index, ...movement }) => movement);
  }

  buildLotAdjustments(snapshot: PortfolioAppState): InvestmentMovementLotAdjustment[] {
    const operations = snapshot.dataset?.operations ?? [];
    const movements = this.buildMovements(snapshot);
    const buckets = this.allocateMovementsToLots(operations, movements);

    return operations
      .map((operation) => this.buildLotAdjustment(operation, buckets.get(this.lotKey(operation)) ?? this.emptyBucket()))
      .sort((a, b) => {
        const symbolDiff = a.symbol.localeCompare(b.symbol, 'es');
        if (symbolDiff !== 0) {
          return symbolDiff;
        }
        const dateDiff = (a.buyDate?.getTime() ?? 0) - (b.buyDate?.getTime() ?? 0);
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return a.operationId.localeCompare(b.operationId, 'es');
      });
  }

  buildSummaryBySymbol(snapshot: PortfolioAppState): InvestmentMovementSummary[] {
    const lotAdjustments = this.buildLotAdjustments(snapshot);
    const grouped = new Map<string, InvestmentMovementLotAdjustment[]>();

    for (const lot of lotAdjustments) {
      const key = this.groupKey(lot.symbol, lot.currency);
      const bucket = grouped.get(key) ?? [];
      bucket.push(lot);
      grouped.set(key, bucket);
    }

    return Array.from(grouped.values())
      .map((bucket) => this.buildSummary(bucket))
      .sort((a, b) => {
        const symbolDiff = a.symbol.localeCompare(b.symbol, 'es');
        if (symbolDiff !== 0) {
          return symbolDiff;
        }
        return a.currency.localeCompare(b.currency, 'es');
      });
  }

  private buildSummary(lots: InvestmentMovementLotAdjustment[]): InvestmentMovementSummary {
    const first = lots[0];
    const marketResultAmount = this.sumNumbers(lots.map((lot) => lot.marketResultAmount));
    const incomeAmount = this.sumNumbers(lots.map((lot) => lot.incomeAmount));
    const capitalReturnedAmount = this.sumNumbers(lots.map((lot) => lot.capitalReturnedAmount));
    const adjustedResultAmount = this.sumNumbers(lots.map((lot) => lot.adjustedResultAmount));
    const investedAmount = this.sumNumbers(lots.map((lot) => lot.investedAmount));
    const currentValue = this.sumNumbers(lots.map((lot) => lot.currentValue));
    const marketResultPercent =
      investedAmount !== null && investedAmount > 0 && marketResultAmount !== null
        ? (marketResultAmount / investedAmount) * 100
        : null;
    const adjustedResultPercent =
      investedAmount !== null && investedAmount > 0 && adjustedResultAmount !== null
        ? (adjustedResultAmount / investedAmount) * 100
        : null;

    return {
      symbol: first.symbol,
      currency: first.currency,
      incomeAmount: incomeAmount ?? 0,
      capitalReturnedAmount: capitalReturnedAmount ?? 0,
      totalMovementsAmount: (incomeAmount ?? 0) + (capitalReturnedAmount ?? 0),
      marketResultAmount: marketResultAmount ?? 0,
      marketResultPercent,
      adjustedResultAmount: adjustedResultAmount ?? 0,
      adjustedResultPercent,
      hasAdjustments: (incomeAmount ?? 0) !== 0 || (capitalReturnedAmount ?? 0) !== 0,
      movementsCount: this.countUniqueMovements(lots),
      notes: this.uniqueNotes(lots.flatMap((lot) => lot.notes))
    };
  }

  private buildLotAdjustment(
    operation: InvestmentOperation,
    bucket: AllocationBucket
  ): InvestmentMovementLotAdjustment {
    const symbol = this.normalization.normalizeSymbol(operation.symbol) ?? '';
    const currency = this.currencyMapper.normalizeCurrency(operation.currency);
    const buyDate = this.normalization.asDate(operation.date);
    const quantity = this.normalization.asNumber(operation.quantity);
    const investedAmount = this.normalization.asNumber(operation.total ?? operation.amount);
    const currentValue = this.normalization.asNumber(operation.currentValue);
    const marketResultAmount =
      investedAmount !== null && currentValue !== null ? currentValue - investedAmount : null;
    const marketResultPercent =
      investedAmount !== null && investedAmount > 0 && marketResultAmount !== null
        ? (marketResultAmount / investedAmount) * 100
        : null;
    const adjustedResultAmount =
      marketResultAmount !== null
        ? marketResultAmount + bucket.incomeAmount + bucket.capitalReturnedAmount
        : null;
    const adjustedResultPercent =
      investedAmount !== null && investedAmount > 0 && adjustedResultAmount !== null
        ? (adjustedResultAmount / investedAmount) * 100
        : null;

    return {
      operationId: operation.id,
      symbol,
      currency,
      buyDate,
      quantity,
      investedAmount,
      currentValue,
      marketResultAmount,
      marketResultPercent,
      incomeAmount: bucket.incomeAmount,
      capitalReturnedAmount: bucket.capitalReturnedAmount,
      adjustedResultAmount,
      adjustedResultPercent,
      movementsCount: bucket.movementIds.size,
      movementIds: Array.from(bucket.movementIds),
      appliedMovements: [...bucket.appliedMovements].sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0)),
      notes: this.uniqueNotes(bucket.notes)
    };
  }

  private allocateMovementsToLots(
    operations: InvestmentOperation[],
    movements: InvestmentMovement[]
  ): Map<string, AllocationBucket> {
    const buckets = new Map<string, AllocationBucket>();
    const lotInfo = operations
      .map((operation, index) => ({
        operation,
        index,
        symbol: this.normalization.normalizeSymbol(operation.symbol) ?? '',
        currency: this.currencyMapper.normalizeCurrency(operation.currency),
        buyDate: this.normalization.asDate(operation.date),
        quantity: this.normalization.asNumber(operation.quantity) ?? 0
      }))
      .filter((lot) => lot.symbol);

    for (const movement of movements) {
      const movementAmount = movement.amount ?? 0;
      if (!movement.symbol || !movement.date || !Number.isFinite(movementAmount)) {
        continue;
      }

      const eligibleLots = lotInfo.filter((lot) => {
        if (lot.symbol !== movement.symbol) {
          return false;
        }
        if (movement.currency !== 'UNKNOWN' && lot.currency !== 'UNKNOWN' && lot.currency !== movement.currency) {
          return false;
        }
        return lot.buyDate !== null && lot.buyDate.getTime() <= movement.date!.getTime();
      });

      const totalQuantity = eligibleLots.reduce((sum, lot) => sum + Math.max(0, lot.quantity), 0);
      if (totalQuantity <= 0) {
        continue;
      }

      for (const lot of eligibleLots) {
        const key = this.lotKey(lot.operation);
        const bucket = buckets.get(key) ?? this.emptyBucket();
        const assignedAmount = movementAmount * (Math.max(0, lot.quantity) / totalQuantity);
        bucket.totalMovementsAmount += assignedAmount;
        bucket.movementsCount += 1;
        bucket.movementIds.add(this.movementKey(movement));

        if (movement.affectsPerformance) {
          bucket.incomeAmount += assignedAmount;
        }

        if (movement.affectsInvestedCapital && movement.capitalEffect === 'reduces-cost') {
          bucket.capitalReturnedAmount += assignedAmount;
        }

        bucket.appliedMovements.push({
          date: movement.date,
          symbol: movement.symbol,
          currency: movement.currency,
          type: movement.type,
          amount: assignedAmount,
          affectsPerformance: movement.affectsPerformance,
          affectsInvestedCapital: movement.affectsInvestedCapital,
          capitalEffect: movement.capitalEffect,
          note: movement.note
        });

        buckets.set(key, bucket);
      }
    }

    return buckets;
  }

  private emptyBucket(): AllocationBucket {
    return {
      incomeAmount: 0,
      capitalReturnedAmount: 0,
      totalMovementsAmount: 0,
      movementsCount: 0,
      movementIds: new Set<string>(),
      appliedMovements: [],
      notes: []
    };
  }

  private lotKey(operation: InvestmentOperation): string {
    return `${this.normalization.normalizeSymbol(operation.symbol) ?? ''}__${this.currencyMapper.normalizeCurrency(operation.currency)}__${operation.id}`;
  }

  private groupKey(symbol: string, currency: string): string {
    return `${symbol}__${currency}`;
  }

  private movementKey(movement: InvestmentMovement): string {
    return `${movement.symbol}__${movement.type}__${movement.date?.toISOString() ?? 'NO_DATE'}__${movement.amount ?? 'NO_AMOUNT'}`;
  }

  private countUniqueMovements(lots: InvestmentMovementLotAdjustment[]): number {
    const uniqueMovementIds = new Set<string>();
    for (const lot of lots) {
      for (const movementId of lot.movementIds) {
        uniqueMovementIds.add(movementId);
      }
    }
    return uniqueMovementIds.size;
  }

  private sumNumbers(values: Array<number | null>): number | null {
    const numeric = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!numeric.length) {
      return null;
    }
    return numeric.reduce((sum, value) => sum + value, 0);
  }

  private uniqueNotes(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
  }
}
