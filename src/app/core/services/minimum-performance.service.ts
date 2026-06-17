import { Injectable } from '@angular/core';
import { CalendarBenchmarkRow, MinimumPerformanceBySymbol, MinimumPerformanceLot, MinimumPerformanceStatus } from '../models/minimum-performance.model';
import { InvestmentOperation } from '../models/portfolio.models';
import { PortfolioAppState } from './portfolio-state.service';
import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';

type BenchmarkSelection = {
  rows: CalendarBenchmarkRow[];
  source: CalendarBenchmarkRow['source'] | null;
  notes: string[];
};

@Injectable({ providedIn: 'root' })
export class MinimumPerformanceService {
  constructor(
    private readonly normalization: DataNormalizationService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  buildLots(snapshot: PortfolioAppState): MinimumPerformanceLot[] {
    const dataset = snapshot.dataset;
    if (!dataset) {
      return [];
    }

    const benchmark = this.resolveBenchmarkRows(dataset.calendarBenchmarks ?? []);
    const benchmarkRows = benchmark.rows;
    const benchmarkEndIndex = this.lastBenchmarkIndex(benchmarkRows);

    return dataset.operations
      .map((operation) => this.buildLot(operation, benchmarkRows, benchmarkEndIndex, benchmark))
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
    const lots = this.buildLots(snapshot);
    const grouped = new Map<string, MinimumPerformanceLot[]>();

    for (const lot of lots) {
      const key = this.groupKey(lot.symbol, lot.currency);
      const bucket = grouped.get(key) ?? [];
      bucket.push(lot);
      grouped.set(key, bucket);
    }

    return Array.from(grouped.values())
      .map((bucket) => this.buildSymbolSummary(bucket))
      .sort((a, b) => {
        const symbolDiff = a.symbol.localeCompare(b.symbol, 'es');
        if (symbolDiff !== 0) {
          return symbolDiff;
        }
        return a.currency.localeCompare(b.currency, 'es');
      });
  }

  findIndexForDate(rows: CalendarBenchmarkRow[], date: Date): number | null {
    const info = this.findBenchmarkIndexInfo(rows, date);
    return info.index;
  }

  private buildLot(
    operation: InvestmentOperation,
    benchmarkRows: CalendarBenchmarkRow[],
    benchmarkEndIndex: number | null,
    benchmark: BenchmarkSelection
  ): MinimumPerformanceLot {
    const symbol = this.normalization.normalizeSymbol(operation.symbol) ?? '';
    const currency = this.currencyMapper.normalizeCurrency(operation.currency);
    const buyDate = this.normalization.asDate(operation.date);
    const quantity = this.normalization.asNumber(operation.quantity);
    const investedAmount = this.normalization.asNumber(operation.total ?? operation.amount);
    const currentValue = this.normalization.asNumber(operation.currentValue);
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
    const hasRequiredData = currency === 'ARS'
      && symbol.length > 0
      && buyDate !== null
      && investedAmount !== null
      && investedAmount > 0
      && currentValue !== null
      && currentValue >= 0
      && startIndex !== null
      && endIndex !== null
      && startIndex > 0
      && endIndex > 0;

    let minimumExpectedValue: number | null = null;
    let minimumExpectedReturnPercent: number | null = null;
    let valueVsMinimumAmount: number | null = null;
    let valueVsMinimumPercent: number | null = null;
    let status: MinimumPerformanceStatus = 'review';

    if (currency !== 'ARS') {
      status = 'not-applicable';
    } else if (!benchmarkRows.length || startIndex === null || endIndex === null) {
      status = 'missing-calendar';
      notes.push('No hay calendario suficiente para calcular');
    } else if (!hasRequiredData) {
      status = 'review';
    } else {
      minimumExpectedValue = investedAmount * (endIndex / startIndex);
      minimumExpectedReturnPercent = ((endIndex / startIndex) - 1) * 100;
      valueVsMinimumAmount = (currentValue ?? 0) - minimumExpectedValue;
      valueVsMinimumPercent = minimumExpectedValue > 0 ? ((currentValue ?? 0) / minimumExpectedValue - 1) * 100 : null;
      status = valueVsMinimumAmount >= 0 ? 'beats-minimum' : 'below-minimum';
    }

    return {
      symbol,
      currency,
      buyDate,
      quantity,
      investedAmount,
      currentValue,
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
    const currentValue = this.sumNumbers(lots.map((lot) => lot.currentValue));
    const minimumExpectedValue = allComparable ? this.sumNumbers(lots.map((lot) => lot.minimumExpectedValue)) : null;
    const valueVsMinimumAmount =
      allComparable && currentValue !== null && minimumExpectedValue !== null ? currentValue - minimumExpectedValue : null;
    const valueVsMinimumPercent =
      allComparable && currentValue !== null && minimumExpectedValue !== null && minimumExpectedValue > 0
        ? ((currentValue / minimumExpectedValue) - 1) * 100
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

  private groupKey(symbol: string, currency: string): string {
    return `${symbol}__${currency}`;
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
