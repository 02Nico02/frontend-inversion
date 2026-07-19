import { Injectable } from '@angular/core';
import { ResearchAutofillResult } from '../models/research-provider.models';

type DailySeriesPoint = {
  date: string;
  close: number;
  high: number;
  low: number;
};

const BASE_URL = 'https://www.alphavantage.co/query';

@Injectable({ providedIn: 'root' })
export class AlphaVantageService {
  async autofill(symbol: string, apiKey: string): Promise<ResearchAutofillResult> {
    const fetchedAt = new Date().toISOString();
    if (!apiKey.trim()) {
      return {
        provider: 'alpha_vantage',
        fetchedAt,
        fields: {},
        warnings: [],
        errors: ['Falta la API key de Alpha Vantage.']
      };
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    try {
      const [overviewResult, seriesResult] = await Promise.all([
        this.safeFetch<Record<string, string>>(this.buildUrl({
          function: 'OVERVIEW',
          symbol: normalizedSymbol,
          apikey: apiKey
        })),
        this.safeFetch<Record<string, unknown>>(this.buildUrl({
          function: 'TIME_SERIES_DAILY',
          symbol: normalizedSymbol,
          outputsize: 'full',
          apikey: apiKey
        }))
      ]);

      const warnings = [...overviewResult.errors, ...seriesResult.errors];
      const fields: Record<string, string> = {};

      const overview = overviewResult.data;
      const series = seriesResult.data;
      const hasOverviewData = Boolean(overview && Object.keys(overview).length);
      const hasSeriesData = Boolean(series && Object.keys(series).length);

      if (hasOverviewData && overview) {
        this.assignFields(fields, this.mapOverviewFields(overview));
      }

      if (hasSeriesData && series) {
        const points = this.normalizeDailySeries(series);
        if (points.length) {
          const latest = points[points.length - 1];
          fields['Precio'] = this.formatNumber(latest.close);
          this.assignTechnicalFields(fields, points, warnings);
          this.assignPerformanceFields(fields, points, warnings);
        } else {
          warnings.push('Alpha Vantage no devolvio historico diario utilizable.');
        }
      }

      if (!hasOverviewData && !hasSeriesData) {
        return {
          provider: 'alpha_vantage',
          fetchedAt,
          fields: {},
          warnings,
          errors: [overviewResult.errors[0] ?? seriesResult.errors[0] ?? 'Alpha Vantage no devolvio datos utilizables.']
        };
      }

      const missingFundamentalFields = this.findMissingFundamentalFields(fields);
      if (hasOverviewData && missingFundamentalFields.length) {
        warnings.push('Alpha Vantage no devolvio algunos campos fundamentales; se dejaron vacios.');
      }

      if (hasOverviewData && !hasSeriesData) {
        warnings.push('No se pudo obtener historico diario; se completaron solo datos fundamentales disponibles.');
      }

      if (!hasOverviewData && hasSeriesData) {
        warnings.push('No se pudo obtener OVERVIEW; se completaron solo precio, tecnicos y performance.');
      }

      if (!Object.keys(fields).length) {
        return {
          provider: 'alpha_vantage',
          fetchedAt,
          fields: {},
          warnings,
          errors: [overviewResult.errors[0] ?? seriesResult.errors[0] ?? 'Alpha Vantage no devolvio datos utilizables.']
        };
      }

      return {
        provider: 'alpha_vantage',
        fetchedAt,
        fields,
        warnings,
        errors: []
      };
    } catch {
      return {
        provider: 'alpha_vantage',
        fetchedAt,
        fields: {},
        warnings: [],
        errors: ['No se pudo completar la consulta a Alpha Vantage.']
      };
    }
  }

  private assignFields(target: Record<string, string>, source: Record<string, string | undefined>): void {
    for (const [key, value] of Object.entries(source)) {
      if (!value) {
        continue;
      }
      target[key] = value;
    }
  }

  private mapOverviewFields(overview: Record<string, string>): Record<string, string> {
    return {
      'Target Price': overview['AnalystTargetPrice'],
      'P/E': overview['PERatio'],
      'Forward P/E': overview['ForwardPE'],
      PEG: overview['PEGRatio'],
      ROE: overview['ReturnOnEquityTTM'],
      'Operating Margin': overview['OperatingMarginTTM'],
      'Profit Margin': overview['ProfitMargin'],
      'EPS Y/Y': overview['QuarterlyEarningsGrowthYOY'],
      'Sales Y/Y': overview['QuarterlyRevenueGrowthYOY'],
      '52W High': overview['52WeekHigh'],
      '52W Low': overview['52WeekLow']
    };
  }

  private assignTechnicalFields(target: Record<string, string>, points: DailySeriesPoint[], warnings: string[]): void {
    const periods: Array<[string, number]> = [
      ['SMA20', 20],
      ['SMA50', 50],
      ['SMA200', 200]
    ];

    const latest = points[points.length - 1];
    for (const [label, period] of periods) {
      const value = this.calculateSma(points, period);
      if (value !== null && value > 0) {
        target[label] = this.formatPercent((latest.close / value) - 1);
      } else {
        warnings.push(`No hay historico suficiente para calcular ${label}.`);
      }
    }

    const rsi = this.calculateRsi(points, 14);
    if (rsi !== null) {
      target['RSI'] = this.formatNumber(rsi);
    }

    if (!target['52W High'] || !target['52W Low']) {
      const yearWindow = this.lastPointsWithin(points, 365);
      if (yearWindow.length) {
        target['52W High'] = target['52W High'] ?? this.formatNumber(Math.max(...yearWindow.map((point) => point.high)));
        target['52W Low'] = target['52W Low'] ?? this.formatNumber(Math.min(...yearWindow.map((point) => point.low)));
      } else {
        warnings.push('No hay suficientes datos para calcular maximos y minimos de 52 semanas.');
      }
    }
  }

  private assignPerformanceFields(target: Record<string, string>, points: DailySeriesPoint[], warnings: string[]): void {
    const latest = points[points.length - 1];
    const targets: Array<[string, Date]> = [
      ['Perf Month', this.shiftDate(latest.date, -30)],
      ['Perf Quarter', this.shiftDate(latest.date, -90)],
      ['Perf Year', this.shiftDate(latest.date, -365)]
    ];

    for (const [label, targetDate] of targets) {
      let base = this.findPointAtOrBefore(points, targetDate);
      if (!base && label === 'Perf Year') {
        base = this.fallbackPublicApiYearBase(points, latest);
        if (base) {
          warnings.push('Perf Year calculado con el primer dato disponible dentro del rango publico de Alpha Vantage.');
        }
      }

      if (!base) {
        warnings.push(`No hay historico suficiente para calcular ${label}.`);
        continue;
      }

      target[label] = this.formatPercent((latest.close / base.close) - 1);
    }

    const yearStart = new Date(Date.UTC(new Date(latest.date).getUTCFullYear(), 0, 1));
    const ytdBase = this.findPointAtOrBefore(points, yearStart);
    if (ytdBase) {
      target['Perf YTD'] = this.formatPercent((latest.close / ytdBase.close) - 1);
    } else {
      warnings.push('No hay historico suficiente para calcular Perf YTD.');
    }
  }

  private calculateSma(points: DailySeriesPoint[], period: number): number | null {
    if (points.length < period) {
      return null;
    }
    const window = points.slice(-period);
    return window.reduce((sum, point) => sum + point.close, 0) / period;
  }

  private calculateRsi(points: DailySeriesPoint[], period: number): number | null {
    if (points.length <= period) {
      return null;
    }

    let gains = 0;
    let losses = 0;
    for (let index = points.length - period; index < points.length; index += 1) {
      const current = points[index];
      const previous = points[index - 1];
      const delta = current.close - previous.close;
      if (delta >= 0) {
        gains += delta;
      } else {
        losses += Math.abs(delta);
      }
    }

    if (gains === 0 && losses === 0) {
      return 50;
    }
    if (losses === 0) {
      return 100;
    }

    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  private collectApiErrors(...payloads: Array<Record<string, unknown> | undefined>): string[] {
    const messages = payloads.flatMap((payload) => {
      if (!payload) {
        return [];
      }
      const note = this.extractString(payload, 'Note');
      const info = this.extractString(payload, 'Information');
      const error = this.extractString(payload, 'Error Message');
      return [note, info, error].filter((value): value is string => Boolean(value));
    });
    return messages;
  }

  private async safeFetch<T>(url: string): Promise<{ data: T | null; errors: string[] }> {
    try {
      const data = await this.fetchJson<T>(url);
      const errors = this.collectApiErrors(data as Record<string, unknown>);
      return errors.length ? { data: null, errors } : { data, errors: [] };
    } catch {
      return { data: null, errors: ['No se pudo consultar Alpha Vantage.'] };
    }
  }

  private extractString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    return typeof value === 'string' && value.trim().length ? value.trim() : null;
  }

  private normalizeDailySeries(payload: Record<string, unknown>): DailySeriesPoint[] {
    const series = this.findSeries(payload, 'Time Series (Daily)');
    if (!series) {
      return [];
    }

    return Object.entries(series)
      .map(([date, values]) => ({
        date,
        close: this.toNumber((values as Record<string, string>)['4. close']),
        high: this.toNumber((values as Record<string, string>)['2. high']),
        low: this.toNumber((values as Record<string, string>)['3. low'])
      }))
      .filter((point) => Number.isFinite(point.close))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private findSeries(payload: Record<string, unknown>, key: string): Record<string, Record<string, string>> | null {
    const series = payload[key];
    if (!series || typeof series !== 'object') {
      return null;
    }
    return series as Record<string, Record<string, string>>;
  }

  private findPointAtOrBefore(points: DailySeriesPoint[], targetDate: Date): DailySeriesPoint | null {
    const targetTime = targetDate.getTime();
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      const time = new Date(point.date).getTime();
      if (Number.isFinite(time) && time <= targetTime) {
        return point;
      }
    }
    return null;
  }

  private fallbackPublicApiYearBase(points: DailySeriesPoint[], latest: DailySeriesPoint): DailySeriesPoint | null {
    const first = points[0];
    if (!first) {
      return null;
    }

    const diffDays = Math.abs(new Date(latest.date).getTime() - new Date(first.date).getTime()) / (24 * 60 * 60 * 1000);
    return diffDays >= 350 && diffDays <= 366 ? first : null;
  }

  private findMissingFundamentalFields(fields: Record<string, string>): string[] {
    const expectedFields = [
      'Target Price',
      'P/E',
      'Forward P/E',
      'PEG',
      'ROE',
      'Operating Margin',
      'Profit Margin',
      'EPS Y/Y',
      'Sales Y/Y',
      '52W High',
      '52W Low'
    ];

    return expectedFields.filter((label) => !String(fields[label] ?? '').trim());
  }

  private lastPointsWithin(points: DailySeriesPoint[], days: number): DailySeriesPoint[] {
    if (!points.length) {
      return [];
    }
    const latestTime = new Date(points[points.length - 1].date).getTime();
    const cutoff = latestTime - (days * 24 * 60 * 60 * 1000);
    return points.filter((point) => new Date(point.date).getTime() >= cutoff);
  }

  private shiftDate(dateValue: string, days: number): Date {
    const date = new Date(dateValue);
    date.setDate(date.getDate() + days);
    return date;
  }

  private buildUrl(params: Record<string, string>): string {
    const search = new URLSearchParams(params);
    return `${BASE_URL}?${search.toString()}`;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private toNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(value);
  }

  private formatPercent(value: number): string {
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value * 100)}%`;
  }
}
