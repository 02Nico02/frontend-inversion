import { Injectable } from '@angular/core';
import { MonthlyInvestmentSummary, MonthlyPerformanceRow } from '../../../core/models/portfolio.models';
import { parseDisplayedPercent, parseExcelDate } from '../../../core/utils/value-parsing.utils';

export type PerformanceType = 'nominal' | 'real';
export type PerformancePeriod = '3M' | '12M' | 'YTD' | 'manual';

export interface PerformanceReference {
  label: string;
  type: PerformanceType;
  period: PerformancePeriod;
  monthsUsed: number;
  annualRatePercent: number | null;
  periodReturnPercent: number | null;
  source: string;
  warning?: string;
}

export interface NormalizedMonthlyRate {
  monthKey: number;
  label: string;
  year: number | null;
  monthIndex: number | null;
  nominalPercent: number | null;
  inflationPercent: number | null;
  realPercent: number | null;
  reportedRealPercent: number | null;
  realPercentSource: 'calculated' | 'reported' | 'missing';
  source: string;
  warning?: string;
}

export interface PerformanceReferenceBundle {
  references: PerformanceReference[];
  monthlyRows: NormalizedMonthlyRate[];
  warnings: string[];
  preferredReference: PerformanceReference | null;
}

@Injectable({ providedIn: 'root' })
export class PerformanceReferenceService {
  build(
    monthlySummary: MonthlyInvestmentSummary[] = [],
    monthlyPerformance: MonthlyPerformanceRow[] = []
  ): PerformanceReferenceBundle {
    const merged = this.mergeRows(
      monthlySummary.map((row) => this.fromMonthlySummary(row)),
      monthlyPerformance.map((row) => this.fromMonthlyPerformance(row))
    );
    const rows = merged.sort((a, b) => a.monthKey - b.monthKey);
    const warnings = this.buildWarnings(rows);

    const nominalRows = rows.filter((row) => row.nominalPercent !== null);
    const realRows = rows.filter((row) => row.realPercent !== null);

    const references: PerformanceReference[] = [
      ...this.buildPeriodReferences('nominal', 'Rendimiento nominal', nominalRows, warnings),
      ...this.buildPeriodReferences('real', 'Rendimiento real', realRows, warnings)
    ];

    return {
      references,
      monthlyRows: rows,
      warnings,
      preferredReference: this.preferredReference(references)
    };
  }

  resolveReference(bundle: PerformanceReferenceBundle, preference: string): PerformanceReference | null {
    return bundle.references.find((reference) => this.preferenceKey(reference) === preference) ?? null;
  }

  preferenceKey(reference: PerformanceReference): string {
    return `${reference.type}:${reference.period}`;
  }

  private buildPeriodReferences(
    type: PerformanceType,
    labelPrefix: string,
    rows: NormalizedMonthlyRate[],
    warnings: string[]
  ): PerformanceReference[] {
    const latest = rows.at(-1) ?? null;
    const latestYear = latest?.year ?? null;
    const references: PerformanceReference[] = [];

    references.push(
      this.buildReference(type, '12M', `${labelPrefix} 12M`, this.lastRows(rows, 12), 'HistorialMensualReconstruido', warnings, true)
    );
    references.push(
      this.buildReference(type, '3M', `${labelPrefix} 3M anualizado`, this.lastRows(rows, 3), 'HistorialMensualReconstruido', warnings, true)
    );
    if (latestYear !== null) {
      const ytdRows = rows.filter((row) => row.year === latestYear);
      references.push(
        this.buildReference(type, 'YTD', `${labelPrefix} YTD`, ytdRows, 'HistorialMensualReconstruido', warnings, false)
      );
    }

    return references;
  }

  private buildReference(
    type: PerformanceType,
    period: PerformancePeriod,
    label: string,
    rows: NormalizedMonthlyRate[],
    source: string,
    warnings: string[],
    annualize: boolean
  ): PerformanceReference {
    const rates = rows
      .map((row) => type === 'real' ? row.realPercent : row.nominalPercent)
      .filter((rate): rate is number => typeof rate === 'number' && Number.isFinite(rate));
    const monthsUsed = rates.length;

    if (!monthsUsed) {
      return {
        label,
        type,
        period,
        monthsUsed: 0,
        annualRatePercent: null,
        periodReturnPercent: null,
        source,
        warning: 'No hay datos suficientes para calcular esta referencia.'
      };
    }

    const periodReturnPercent = this.compoundPercent(rates) * 100;
    const annualRatePercent = annualize
      ? this.annualizeFromPeriodReturn(periodReturnPercent, monthsUsed)
      : periodReturnPercent;

    const suspicious = this.isSuspicious(type, period, annualRatePercent, monthsUsed);
    const warning = suspicious
      ? `${warnings.length ? `${warnings[0]} · ` : ''}Tasa sospechosa, revisar antes de usar como default.`
      : warnings[0];

    return {
      label,
      type,
      period,
      monthsUsed,
      annualRatePercent,
      periodReturnPercent,
      source,
      warning
    };
  }

  private buildWarnings(rows: NormalizedMonthlyRate[]): string[] {
    const warnings: string[] = [];
    if (!rows.length) {
      warnings.push('No hay series mensuales para calcular referencias.');
      return warnings;
    }

    const missingNominal = rows.filter((row) => row.nominalPercent === null).length;
    const missingReal = rows.filter((row) => row.realPercent === null).length;
    const mismatchedReal = rows.filter((row) => row.warning?.includes('real recalculado')).length;

    if (missingNominal) {
      warnings.push(`Hay ${missingNominal} meses sin variacion nominal.`);
    }
    if (missingReal) {
      warnings.push(`Hay ${missingReal} meses sin rendimiento real.`);
    }
    if (mismatchedReal) {
      warnings.push(`Hay ${mismatchedReal} meses con diferencia entre real reportado y recalculado.`);
    }

    return warnings;
  }

  private mergeRows(
    summaryRows: NormalizedMonthlyRate[],
    performanceRows: NormalizedMonthlyRate[]
  ): NormalizedMonthlyRate[] {
    const byKey = new Map<number, NormalizedMonthlyRate>();

    for (const row of summaryRows) {
      byKey.set(row.monthKey, row);
    }

    for (const row of performanceRows) {
      const existing = byKey.get(row.monthKey);
      if (!existing) {
        byKey.set(row.monthKey, row);
        continue;
      }

      byKey.set(row.monthKey, {
        ...existing,
        nominalPercent: existing.nominalPercent ?? row.nominalPercent,
        inflationPercent: existing.inflationPercent ?? row.inflationPercent,
        realPercent: existing.realPercent ?? row.realPercent,
        reportedRealPercent: existing.reportedRealPercent ?? row.reportedRealPercent,
        realPercentSource: existing.realPercentSource !== 'missing' ? existing.realPercentSource : row.realPercentSource,
        warning: existing.warning ?? row.warning,
        source: existing.source
      });
    }

    return Array.from(byKey.values()).sort((a, b) => a.monthKey - b.monthKey);
  }

  private fromMonthlySummary(row: MonthlyInvestmentSummary): NormalizedMonthlyRate {
    const parsed = this.parseMonthLabel(row.month, row.year);
    const nominalPercent = this.parseMonthlyPercent(row.variationPercent);
    const inflationPercent = this.parseMonthlyPercent(row.inflationPercent);
    const reportedRealPercent = this.parseMonthlyPercent(row.realReturnPercent);
    const calculatedRealPercent = this.calculateRealPercent(nominalPercent, inflationPercent);
    const realPercent = calculatedRealPercent ?? reportedRealPercent;
    const realPercentSource: NormalizedMonthlyRate['realPercentSource'] = calculatedRealPercent !== null
      ? 'calculated'
      : reportedRealPercent !== null
        ? 'reported'
        : 'missing';

    return {
      monthKey: parsed.monthKey,
      label: parsed.label,
      year: parsed.year,
      monthIndex: parsed.monthIndex,
      nominalPercent,
      inflationPercent,
      realPercent,
      reportedRealPercent,
      realPercentSource,
      source: 'HistorialMensualReconstruido',
      warning: this.realMismatchWarning(reportedRealPercent, calculatedRealPercent)
    };
  }

  private fromMonthlyPerformance(row: MonthlyPerformanceRow): NormalizedMonthlyRate {
    const parsed = this.parseMonthLabel(row.month, null);
    const nominalPercent = this.parseMonthlyPercent(row.variationPercent);
    const reportedRealPercent = this.parseMonthlyPercent(row.realReturnPercent);
    return {
      monthKey: parsed.monthKey,
      label: parsed.label,
      year: parsed.year,
      monthIndex: parsed.monthIndex,
      nominalPercent,
      inflationPercent: null,
      realPercent: reportedRealPercent,
      reportedRealPercent,
      realPercentSource: reportedRealPercent !== null ? 'reported' : 'missing',
      source: 'Tabla9'
    };
  }

  private parseMonthLabel(label: string, yearFallback: number | null): { monthKey: number; label: string; year: number | null; monthIndex: number | null } {
    const text = String(label ?? '').trim();

    const monthMatch = /^([A-Za-záéíóúüñÁÉÍÓÚÜÑ]{3,})[\s/-]?(\d{2,4})$/.exec(text);
    if (monthMatch) {
      const monthIndex = this.monthNameToIndex(monthMatch[1]);
      if (monthIndex !== null) {
        const rawYear = Number(monthMatch[2]);
        const year = rawYear < 100 ? (rawYear < 70 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
        return {
          monthKey: year * 12 + monthIndex,
          label: this.formatMonthLabel(year, monthIndex),
          year,
          monthIndex
        };
      }
    }

    const directDate = this.tryParseDate(text);
    if (directDate) {
      const year = directDate.getUTCFullYear();
      const monthIndex = directDate.getUTCMonth();
      return {
        monthKey: year * 12 + monthIndex,
        label: this.formatMonthLabel(year, monthIndex),
        year,
        monthIndex
      };
    }

    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      const parsed = this.tryParseDate(numeric);
      if (parsed) {
        const year = parsed.getUTCFullYear();
        const monthIndex = parsed.getUTCMonth();
        return {
          monthKey: year * 12 + monthIndex,
          label: this.formatMonthLabel(year, monthIndex),
          year,
          monthIndex
        };
      }
    }

    if (yearFallback !== null) {
      return {
        monthKey: yearFallback * 12,
        label: text || String(yearFallback),
        year: yearFallback,
        monthIndex: null
      };
    }

    return {
      monthKey: 0,
      label: text || 'N/D',
      year: null,
      monthIndex: null
    };
  }

  private monthNameToIndex(value: string): number | null {
    const normalized = value.trim().toLowerCase();
    const months: Record<string, number> = {
      ene: 0,
      enero: 0,
      feb: 1,
      febrero: 1,
      mar: 2,
      marzo: 2,
      abr: 3,
      abril: 3,
      may: 4,
      mayo: 4,
      jun: 5,
      junio: 5,
      jul: 6,
      julio: 6,
      ago: 7,
      agosto: 7,
      sep: 8,
      sept: 8,
      septiembre: 8,
      setiembre: 8,
      oct: 9,
      octubre: 9,
      nov: 10,
      noviembre: 10,
      dic: 11,
      diciembre: 11
    };
    return months[normalized] ?? null;
  }

  private tryParseDate(value: string | number): Date | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.excelSerialToDate(value);
    }
    const text = String(value).trim();
    if (!text) {
      return null;
    }
    const serial = Number(text);
    if (Number.isFinite(serial)) {
      return this.excelSerialToDate(serial);
    }
    if (/^\d{4}-\d{2}$/.test(text)) {
      const [year, month] = text.split('-').map((part) => Number(part));
      const date = new Date(Date.UTC(year, month - 1, 1));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = parseExcelDate(text);
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  private excelSerialToDate(serial: number): Date | null {
    let normalizedSerial = serial;
    const maxExcelSerial = 2958465;
    while (normalizedSerial > maxExcelSerial && normalizedSerial % 100 === 0) {
      normalizedSerial /= 100;
    }
    const date = new Date(Date.UTC(1899, 11, 30) + normalizedSerial * 24 * 60 * 60 * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatMonthLabel(year: number, monthIndex: number): string {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${months[monthIndex]}-${String(year).slice(-2)}`;
  }

  private parseMonthlyPercent(value: unknown): number | null {
    return parseDisplayedPercent(value);
  }

  private calculateRealPercent(nominalPercent: number | null, inflationPercent: number | null): number | null {
    if (nominalPercent === null || inflationPercent === null) {
      return null;
    }
    return ((1 + nominalPercent / 100) / (1 + inflationPercent / 100) - 1) * 100;
  }

  private realMismatchWarning(reportedReal: number | null, calculatedReal: number | null): string | undefined {
    if (reportedReal === null || calculatedReal === null) {
      return undefined;
    }
    return Math.abs(reportedReal - calculatedReal) > 1 ? 'real recalculated; reported inconsistent' : undefined;
  }

  private annualizeFromPeriodReturn(periodReturnPercent: number, monthsUsed: number): number | null {
    if (!monthsUsed || monthsUsed < 3) {
      return null;
    }
    const periodReturn = periodReturnPercent / 100;
    return (Math.pow(1 + periodReturn, 12 / monthsUsed) - 1) * 100;
  }

  private compoundPercent(values: number[]): number {
    return values.reduce((accumulator, value) => accumulator * (1 + value / 100), 1) - 1;
  }

  private lastRows(rows: NormalizedMonthlyRate[], count: number): NormalizedMonthlyRate[] {
    return rows.slice(Math.max(0, rows.length - count));
  }

  private isSuspicious(type: PerformanceType, period: PerformancePeriod, annualRatePercent: number | null, monthsUsed: number): boolean {
    if (annualRatePercent === null) {
      return false;
    }
    if (monthsUsed < 3) {
      return false;
    }
    if (type === 'real' && annualRatePercent > 60) {
      return true;
    }
    if (type === 'nominal' && annualRatePercent > 120) {
      return true;
    }
    if (period === '3M' && annualRatePercent > 120) {
      return true;
    }
    return false;
  }

  private preferredReference(references: PerformanceReference[]): PerformanceReference | null {
    return references.find((reference) => reference.type === 'real' && reference.period === '12M' && reference.annualRatePercent !== null && !reference.warning?.includes('suspicious'))
      ?? references.find((reference) => reference.type === 'real' && reference.period === 'YTD' && reference.annualRatePercent !== null && !reference.warning?.includes('suspicious'))
      ?? references.find((reference) => reference.type === 'real' && reference.period === '3M' && reference.annualRatePercent !== null && !reference.warning?.includes('suspicious'))
      ?? references.find((reference) => reference.type === 'nominal' && reference.period === '12M' && reference.annualRatePercent !== null && !reference.warning?.includes('suspicious'))
      ?? references.find((reference) => reference.type === 'nominal' && reference.period === 'YTD' && reference.annualRatePercent !== null && !reference.warning?.includes('suspicious'))
      ?? null;
  }
}
