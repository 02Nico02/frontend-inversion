import { Injectable } from '@angular/core';
import { CalendarBenchmarkRow, MinimumPerformanceBySymbol, MinimumPerformanceLot, MinimumPerformanceStatus, MinimumPerformanceSummary } from '../models/minimum-performance.model';
import { InvestmentOperation } from '../models/portfolio.models';
import { PortfolioAppState } from './portfolio-state.service';
import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';
import { InvestmentMovementsPerformanceService } from './investment-movements-performance.service';
import { AppliedInvestmentMovement } from '../models/investment-movements.model';

type BenchmarkSelection = {
  rows: CalendarBenchmarkRow[];
  source: CalendarBenchmarkRow['source'] | null;
  notes: string[];
};

type AmortizationBenchmarkResult = {
  usesAdjustedBenchmark: boolean;
  minimumExpectedValueAdjusted: number | null;
  benchmarkAccruedAmount: number | null;
  remainingExposedCapital: number | null;
};

@Injectable({ providedIn: 'root' })
export class MinimumPerformanceService {
  constructor(
    private readonly normalization: DataNormalizationService,
    private readonly currencyMapper: CurrencyMapperService,
    private readonly movementsPerformance: InvestmentMovementsPerformanceService
  ) {}

  buildLots(snapshot: PortfolioAppState, adjustForMovements = true): MinimumPerformanceLot[] {
    const dataset = snapshot.dataset;
    if (!dataset) {
      return [];
    }

    const benchmark = this.resolveBenchmarkRows(dataset.calendarBenchmarks ?? []);
    const benchmarkRows = benchmark.rows;
    const benchmarkEndIndex = this.lastBenchmarkIndex(benchmarkRows);
    const movementAdjustments = adjustForMovements ? this.movementsPerformance.buildLotAdjustments(snapshot) : [];
    const movementAdjustmentsByOperation = new Map(movementAdjustments.map((lot) => [lot.operationId, lot]));

    return dataset.operations
      .map((operation) =>
        this.buildLot(
          operation,
          benchmarkRows,
          benchmarkEndIndex,
          benchmark,
          movementAdjustmentsByOperation.get(String(operation.id)) ?? null
        )
      )
      .sort((a, b) => {
        const symbolDiff = a.symbol.localeCompare(b.symbol, 'es');
        if (symbolDiff !== 0) {
          return symbolDiff;
        }
        const dateDiff = this.dateValue(a.buyDate) - this.dateValue(b.buyDate);
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return a.currency.localeCompare(b.currency, 'es');
      });
  }

  buildMinimumPerformanceBySymbol(snapshot: PortfolioAppState): MinimumPerformanceBySymbol[] {
    const lots = this.buildLots(snapshot, true);
    const movementCountsByGroup = this.countMovementsByGroup(this.movementsPerformance.buildMovements(snapshot));
    const grouped = new Map<string, MinimumPerformanceLot[]>();

    for (const lot of lots) {
      const key = this.groupKey(lot.symbol, lot.currency);
      const bucket = grouped.get(key) ?? [];
      bucket.push(lot);
      grouped.set(key, bucket);
    }

    return Array.from(grouped.entries())
      .map(([key, bucket]) => {
        const summary = this.buildSymbolSummary(bucket);
        if (!summary.usesAdjustedComparableValue && (movementCountsByGroup.get(key) ?? 0) > 0) {
          summary.notes = this.uniqueNotes([
            ...summary.notes,
            'Movimientos detectados, pero no se pudieron aplicar al benchmark minimo.'
          ]);
        }
        return summary;
      })
      .sort((a, b) => {
        const symbolDiff = a.symbol.localeCompare(b.symbol, 'es');
        if (symbolDiff !== 0) {
          return symbolDiff;
        }
        return a.currency.localeCompare(b.currency, 'es');
      });
  }

  buildMinimumPerformanceSummary(snapshot: PortfolioAppState): MinimumPerformanceSummary {
    const lots = this.buildLots(snapshot, false).filter((lot) => lot.currency === 'ARS');
    const comparableLots = lots.filter((lot) => lot.status === 'beats-minimum' || lot.status === 'below-minimum');

    if (!comparableLots.length) {
      return {
        currency: 'ARS',
        comparableLotsCount: 0,
        currentComparableArs: null,
        minimumExpectedArs: null,
        balanceVsMinimumArs: null,
        balanceVsMinimumPercentArs: null,
        status: 'missing',
        description: 'No hay datos suficientes para calcular el benchmark minimo.',
        notes: this.uniqueNotes([
          ...lots.flatMap((lot) => lot.notes),
          'No hay posiciones ARS comparables para el benchmark minimo.'
        ])
      };
    }

    const currentComparableArs = this.sumNumbers(comparableLots.map((lot) => lot.currentValue));
    const minimumExpectedArs = this.sumNumbers(comparableLots.map((lot) => lot.minimumExpectedValue));

    if (currentComparableArs === null || minimumExpectedArs === null || minimumExpectedArs <= 0) {
      return {
        currency: 'ARS',
        comparableLotsCount: comparableLots.length,
        currentComparableArs: currentComparableArs ?? null,
        minimumExpectedArs: minimumExpectedArs ?? null,
        balanceVsMinimumArs: null,
        balanceVsMinimumPercentArs: null,
        status: 'missing',
        description: 'No hay datos suficientes para calcular el benchmark minimo.',
        notes: this.uniqueNotes([
          ...comparableLots.flatMap((lot) => lot.notes),
          'No hay valores suficientes para calcular el agregado.'
        ])
      };
    }

    const balanceVsMinimumArs = currentComparableArs - minimumExpectedArs;
    const balanceVsMinimumPercentArs = ((currentComparableArs / minimumExpectedArs) - 1) * 100;
    const status: MinimumPerformanceSummary['status'] =
      balanceVsMinimumArs > 0 ? 'positive' : balanceVsMinimumArs < 0 ? 'negative' : 'neutral';

    return {
      currency: 'ARS',
      comparableLotsCount: comparableLots.length,
      currentComparableArs,
      minimumExpectedArs,
      balanceVsMinimumArs,
      balanceVsMinimumPercentArs,
      status,
      description:
        status === 'positive'
          ? 'El portafolio ARS supera el rendimiento minimo esperado.'
          : status === 'negative'
            ? 'El portafolio ARS esta por debajo del rendimiento minimo esperado.'
            : 'El portafolio ARS esta en linea con el rendimiento minimo esperado.',
      notes: this.uniqueNotes(comparableLots.flatMap((lot) => lot.notes))
    };
  }

  findIndexForDate(rows: CalendarBenchmarkRow[], date: Date): number | null {
    const info = this.findBenchmarkIndexInfo(rows, date);
    return info.index;
  }

  private buildLot(
    operation: InvestmentOperation,
    benchmarkRows: CalendarBenchmarkRow[],
    benchmarkEndIndex: number | null,
    benchmark: BenchmarkSelection,
    movementAdjustment: ReturnType<InvestmentMovementsPerformanceService['buildLotAdjustments']>[number] | null
  ): MinimumPerformanceLot {
    const symbol = this.normalization.normalizeSymbol(operation.symbol) ?? '';
    const currency = this.currencyMapper.normalizeCurrency(operation.currency);
    const buyDate = this.normalization.asDate(operation.date);
    const quantity = this.normalization.asNumber(operation.quantity);
    const investedAmount = this.normalization.asNumber(operation.total ?? operation.amount);
    const currentValue = this.normalization.asNumber(operation.currentValue);
    const incomeAmount = movementAdjustment?.incomeAmount ?? 0;
    const capitalReturnedAmount = movementAdjustment?.capitalReturnedAmount ?? 0;
    const comparableValue = currentValue !== null ? currentValue + incomeAmount + capitalReturnedAmount : null;
    const usesAdjustedComparableValue = Boolean(
      movementAdjustment?.movementsCount && (incomeAmount !== 0 || capitalReturnedAmount !== 0)
    );
    const amortizationMovements = this.amortizationMovements(movementAdjustment?.appliedMovements ?? []);
    const notes = [...benchmark.notes];

    if (!symbol) {
      notes.push('Fila sin especie');
    }

    if (!buyDate) {
      notes.push('Fecha de compra no valida');
    }

    if (quantity === null || quantity <= 0) {
      notes.push('Cantidad no informada');
    }

    if (investedAmount === null || investedAmount <= 0) {
      notes.push('Monto invertido no disponible');
    }

    if (currentValue === null || currentValue < 0) {
      notes.push('Valor actual no disponible');
    }

    if (currency !== 'ARS') {
      notes.push('Benchmark minimo disponible solo para ARS');
    }

    const startInfo = buyDate ? this.findBenchmarkIndexInfo(benchmarkRows, buyDate) : { index: null, beforeStart: false, afterEnd: false };
    if (startInfo.beforeStart) {
      notes.push('La compra es anterior al inicio del benchmark; se uso el primer indice disponible');
    }
    if (startInfo.afterEnd) {
      notes.push('La compra queda luego del ultimo punto de benchmark');
    }

    const startIndex = startInfo.index;
    const endIndex = benchmarkEndIndex;
    const rawMinimumExpectedValue =
      investedAmount !== null && startIndex !== null && endIndex !== null && startIndex > 0 && endIndex > 0
        ? investedAmount * (endIndex / startIndex)
        : null;
    const adjustedBenchmark = this.buildAmortizationAdjustedBenchmark(
      investedAmount,
      startIndex,
      endIndex,
      benchmarkRows,
      amortizationMovements,
      notes
    );
    const hasRequiredData =
      currency === 'ARS' &&
      symbol.length > 0 &&
      buyDate !== null &&
      investedAmount !== null &&
      investedAmount > 0 &&
      comparableValue !== null &&
      comparableValue >= 0 &&
      startIndex !== null &&
      endIndex !== null &&
      startIndex > 0 &&
      endIndex > 0;

    let minimumExpectedValue: number | null = null;
    let minimumExpectedReturnPercent: number | null = null;
    let valueVsMinimumAmount: number | null = null;
    let valueVsMinimumPercent: number | null = null;
    let status: MinimumPerformanceStatus = 'review';
    let benchmarkAccruedAmount: number | null = null;
    let remainingExposedCapital: number | null = null;
    let usesAmortizationAdjustedBenchmark = false;

    if (currency !== 'ARS') {
      status = 'not-applicable';
    } else if (!benchmarkRows.length || startIndex === null || endIndex === null) {
      status = 'missing-calendar';
      notes.push('No hay calendario suficiente para calcular');
    } else if (!hasRequiredData) {
      status = 'review';
    } else {
      minimumExpectedReturnPercent = ((endIndex / startIndex) - 1) * 100;
      if (adjustedBenchmark.usesAdjustedBenchmark) {
        minimumExpectedValue = adjustedBenchmark.minimumExpectedValueAdjusted;
        benchmarkAccruedAmount = adjustedBenchmark.benchmarkAccruedAmount;
        remainingExposedCapital = adjustedBenchmark.remainingExposedCapital;
        usesAmortizationAdjustedBenchmark = true;
      } else {
        minimumExpectedValue = rawMinimumExpectedValue;
      }
      valueVsMinimumAmount = (comparableValue ?? 0) - (minimumExpectedValue ?? 0);
      const effectiveMinimumExpectedValue = minimumExpectedValue;
      valueVsMinimumPercent =
        effectiveMinimumExpectedValue !== null && effectiveMinimumExpectedValue > 0
          ? ((comparableValue ?? 0) / effectiveMinimumExpectedValue - 1) * 100
          : null;
      status = valueVsMinimumAmount >= 0 ? 'beats-minimum' : 'below-minimum';
    }

    return {
      symbol,
      currency,
      buyDate,
      quantity,
      investedAmount,
      currentValue,
      marketCurrentValue: currentValue,
      comparableValue,
      usesAdjustedComparableValue,
      incomeAmount,
      capitalReturnedAmount,
      minimumExpectedValueRaw: rawMinimumExpectedValue,
      minimumExpectedValueAdjusted: adjustedBenchmark.minimumExpectedValueAdjusted,
      usesAmortizationAdjustedBenchmark,
      benchmarkAccruedAmount,
      remainingExposedCapital,
      benchmarkStartIndex: startIndex,
      benchmarkEndIndex: endIndex,
      minimumExpectedValue,
      minimumExpectedReturnPercent,
      valueVsMinimumAmount,
      valueVsMinimumPercent,
      status,
      notes: this.uniqueNotes(notes)
    };
  }

  private buildSymbolSummary(lots: MinimumPerformanceLot[]): MinimumPerformanceBySymbol {
    const first = lots[0];
    const allNotApplicable = lots.every((lot) => lot.status === 'not-applicable');
    const hasMissingCalendar = lots.some((lot) => lot.status === 'missing-calendar');
    const hasReview = lots.some((lot) => lot.status === 'review');
    const allComparable = lots.every((lot) => lot.status === 'beats-minimum' || lot.status === 'below-minimum');
    const investedAmount = this.sumNumbers(lots.map((lot) => lot.investedAmount));
    const marketCurrentValue = this.sumNumbers(lots.map((lot) => lot.marketCurrentValue ?? lot.currentValue));
    const currentValue = marketCurrentValue;
    const comparableValue = this.sumNumbers(lots.map((lot) => lot.comparableValue ?? lot.currentValue));
    const usesAdjustedComparableValue = lots.some((lot) => lot.usesAdjustedComparableValue);
    const incomeAmount = this.sumNumbers(lots.map((lot) => lot.incomeAmount)) ?? 0;
    const capitalReturnedAmount = this.sumNumbers(lots.map((lot) => lot.capitalReturnedAmount)) ?? 0;
    const minimumExpectedValueRaw = this.sumNumbers(lots.map((lot) => lot.minimumExpectedValueRaw ?? lot.minimumExpectedValue));
    const minimumExpectedValueAdjusted = this.sumNumbers(lots.map((lot) => lot.minimumExpectedValueAdjusted ?? lot.minimumExpectedValue));
    const usesAmortizationAdjustedBenchmark = lots.some((lot) => lot.usesAmortizationAdjustedBenchmark);
    const benchmarkAccruedAmount = this.sumNumbers(lots.map((lot) => lot.benchmarkAccruedAmount));
    const remainingExposedCapital = this.sumNumbers(lots.map((lot) => lot.remainingExposedCapital));
    const minimumExpectedValue = allComparable ? this.sumNumbers(lots.map((lot) => lot.minimumExpectedValue)) : null;
    const valueVsMinimumAmount =
      allComparable && comparableValue !== null && minimumExpectedValue !== null ? comparableValue - minimumExpectedValue : null;
    const valueVsMinimumPercent =
      allComparable && comparableValue !== null && minimumExpectedValue !== null && minimumExpectedValue > 0
        ? ((comparableValue / minimumExpectedValue) - 1) * 100
        : null;

    let status: MinimumPerformanceStatus = 'review';
    if (allNotApplicable) {
      status = 'not-applicable';
    } else if (hasMissingCalendar) {
      status = 'missing-calendar';
    } else if (hasReview || investedAmount === null || currentValue === null || minimumExpectedValue === null) {
      status = 'review';
    } else {
      status = valueVsMinimumAmount !== null && valueVsMinimumAmount >= 0 ? 'beats-minimum' : 'below-minimum';
    }

    return {
      symbol: first.symbol,
      currency: first.currency,
      lotsCount: lots.length,
      investedAmount,
      currentValue,
      marketCurrentValue,
      comparableValue,
      usesAdjustedComparableValue,
      incomeAmount,
      capitalReturnedAmount,
      minimumExpectedValueRaw,
      minimumExpectedValueAdjusted,
      usesAmortizationAdjustedBenchmark,
      benchmarkAccruedAmount,
      remainingExposedCapital,
      minimumExpectedValue,
      valueVsMinimumAmount,
      valueVsMinimumPercent,
      status,
      lots,
      notes: this.uniqueNotes(lots.flatMap((lot) => lot.notes))
    };
  }

  private resolveBenchmarkRows(rows: CalendarBenchmarkRow[]): BenchmarkSelection {
    const priority: CalendarBenchmarkRow['source'][] = ['TablaCalendario', 'TablaCalendarioRem', 'TablaCalendarioInf'];
    for (const source of priority) {
      const selected = rows
        .filter((row) => row.source === source && row.index !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      if (selected.length) {
        return {
          rows: selected,
          source,
          notes: source === 'TablaCalendario'
            ? []
            : [`Se utilizo ${source} como respaldo de calendario.`]
        };
      }
    }

    return {
      rows: [],
      source: null,
      notes: ['No se encontraron filas de calendario para calcular el minimo esperado.']
    };
  }

  private findBenchmarkIndexInfo(
    rows: CalendarBenchmarkRow[],
    date: Date
  ): { index: number | null; beforeStart: boolean; afterEnd: boolean } {
    if (!rows.length) {
      return { index: null, beforeStart: false, afterEnd: false };
    }

    const target = date.getTime();
    const first = rows[0];
    const last = rows[rows.length - 1];

    if (target < first.date.getTime()) {
      return {
        index: first.index,
        beforeStart: true,
        afterEnd: false
      };
    }

    if (target > last.date.getTime()) {
      return {
        index: last.index,
        beforeStart: false,
        afterEnd: true
      };
    }

    let candidate = first;
    for (const row of rows) {
      if (row.date.getTime() <= target) {
        candidate = row;
        continue;
      }
      break;
    }

    return {
      index: candidate.index,
      beforeStart: false,
      afterEnd: false
    };
  }

  private lastBenchmarkIndex(rows: CalendarBenchmarkRow[]): number | null {
    const last = rows.at(-1);
    return last?.index ?? null;
  }

  private amortizationMovements(movements: AppliedInvestmentMovement[]): AppliedInvestmentMovement[] {
    return movements
      .filter((movement) =>
        movement.affectsInvestedCapital && movement.capitalEffect === 'reduces-cost' && movement.amount > 0
      )
      .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
  }

  private buildAmortizationAdjustedBenchmark(
    investedAmount: number | null,
    startIndex: number | null,
    endIndex: number | null,
    benchmarkRows: CalendarBenchmarkRow[],
    amortizationMovements: AppliedInvestmentMovement[],
    notes: string[]
  ): AmortizationBenchmarkResult {
    if (!amortizationMovements.length) {
      return {
        usesAdjustedBenchmark: false,
        minimumExpectedValueAdjusted: null,
        benchmarkAccruedAmount: null,
        remainingExposedCapital: null
      };
    }

    if (investedAmount === null || investedAmount <= 0 || startIndex === null || endIndex === null || startIndex <= 0 || endIndex <= 0) {
      notes.push('No se pudo ajustar el benchmark por amortizaciones por falta de datos.');
      return {
        usesAdjustedBenchmark: false,
        minimumExpectedValueAdjusted: null,
        benchmarkAccruedAmount: null,
        remainingExposedCapital: null
      };
    }

    let exposedCapital = investedAmount;
    let lastIndex = startIndex;
    let benchmarkAccruedAmount = 0;
    let usesAdjustedBenchmark = false;

    for (const movement of amortizationMovements) {
      if (!movement.date) {
        notes.push('Se omitio una amortizacion sin fecha para ajustar el benchmark.');
        continue;
      }

      const movementIndexInfo = this.findBenchmarkIndexInfo(benchmarkRows, movement.date);
      const movementIndex = movementIndexInfo.index;
      if (movementIndex === null || movementIndex <= 0) {
        notes.push('No se pudo ubicar una amortizacion en el calendario de benchmark.');
        continue;
      }

      const benchmarkBeforeAmortization = exposedCapital * (movementIndex / lastIndex);
      benchmarkAccruedAmount += benchmarkBeforeAmortization - exposedCapital;

      exposedCapital = Math.max(0, exposedCapital - movement.amount);
      lastIndex = movementIndex;
      usesAdjustedBenchmark = true;

      if (exposedCapital <= 0) {
        notes.push('La amortizacion consumio todo el capital expuesto; el benchmark quedo en cero.');
        exposedCapital = 0;
        break;
      }
    }

    const finalMinimumExpectedValue = exposedCapital > 0 ? exposedCapital * (endIndex / lastIndex) : 0;

    return {
      usesAdjustedBenchmark,
      minimumExpectedValueAdjusted: benchmarkAccruedAmount + finalMinimumExpectedValue,
      benchmarkAccruedAmount,
      remainingExposedCapital: exposedCapital
    };
  }

  private groupKey(symbol: string, currency: string): string {
    return `${symbol}__${currency}`;
  }

  private countMovementsByGroup(movements: ReturnType<InvestmentMovementsPerformanceService['buildMovements']>): Map<string, number> {
    const grouped = new Map<string, number>();
    for (const movement of movements) {
      const key = this.groupKey(movement.symbol, movement.currency);
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return grouped;
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

  private dateValue(value: Date | null | undefined): number {
    return value ? value.getTime() : 0;
  }
}
