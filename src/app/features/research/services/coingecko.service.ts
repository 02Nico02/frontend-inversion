import { Injectable } from '@angular/core';
import { ResearchAutofillResult } from '../models/research-provider.models';

type PricePoint = {
  time: number;
  price: number;
};

const BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum'
};

@Injectable({ providedIn: 'root' })
export class CoinGeckoService {
  async autofill(symbol: string, apiKey: string): Promise<ResearchAutofillResult> {
    const fetchedAt = new Date().toISOString();
    const id = COINGECKO_IDS[symbol.trim().toUpperCase()];
    if (!id) {
      return {
        provider: 'coingecko',
        fetchedAt,
        fields: {},
        warnings: [],
        errors: ['CoinGecko solo está configurado para BTC y ETH en este MVP.']
      };
    }

    try {
      const chart = await this.fetchJson<Record<string, unknown>>(this.buildUrl(`/coins/${id}/market_chart`, {
        vs_currency: 'usd',
        days: '400',
        interval: 'daily'
      }), apiKey);

      const points = this.normalizeChart(chart);
      if (!points.length) {
        return {
          provider: 'coingecko',
          fetchedAt,
          fields: {},
          warnings: [],
          errors: ['CoinGecko no devolvió histórico suficiente para la criptomoneda seleccionada.']
        };
      }

      const latest = points[points.length - 1];
      const fields: Record<string, string> = {
        Precio: this.formatNumber(latest.price)
      };
      const warnings: string[] = [];

      this.assignRangeFields(fields, points, warnings);
      this.assignPerformanceFields(fields, points, warnings);
      this.assignIndicators(fields, points);

      return {
        provider: 'coingecko',
        fetchedAt,
        fields,
        warnings,
        errors: []
      };
    } catch {
      return {
        provider: 'coingecko',
        fetchedAt,
        fields: {},
        warnings: [],
        errors: ['No se pudo completar la consulta a CoinGecko.']
      };
    }
  }

  private assignRangeFields(target: Record<string, string>, points: PricePoint[], warnings: string[]): void {
    const yearWindow = this.lastPointsWithin(points, 365);
    if (!yearWindow.length) {
      warnings.push('No hay histórico suficiente para calcular máximos y mínimos de 52 semanas.');
      return;
    }

    target['52W High'] = this.formatNumber(Math.max(...yearWindow.map((point) => point.price)));
    target['52W Low'] = this.formatNumber(Math.min(...yearWindow.map((point) => point.price)));
  }

  private assignPerformanceFields(target: Record<string, string>, points: PricePoint[], warnings: string[]): void {
    const latest = points[points.length - 1];
    const targets: Array<[string, number]> = [
      ['Perf Month', 30],
      ['Perf Quarter', 90],
      ['Perf Year', 365]
    ];

    for (const [label, days] of targets) {
      let base = this.findPointAtOrBefore(points, this.shiftTime(latest.time, -days));
      if (!base && label === 'Perf Year') {
        base = this.fallbackYearBase(points, latest);
        if (base) {
          warnings.push('Perf Year calculado con el primer dato disponible cercano a 1 año.');
        }
      }

      if (!base) {
        warnings.push(`No hay histórico suficiente para calcular ${label}.`);
        continue;
      }
      target[label] = this.formatPercent((latest.price / base.price) - 1);
    }

    const currentYear = new Date(latest.time).getFullYear();
    const ytdBase = this.findPointAtOrBefore(points, Date.UTC(currentYear, 0, 1));
    if (ytdBase) {
      target['Perf YTD'] = this.formatPercent((latest.price / ytdBase.price) - 1);
    }
  }

  private assignIndicators(target: Record<string, string>, points: PricePoint[]): void {
    const closes = points.map((point) => point.price);
    const sma20 = this.calculateSma(closes, 20);
    const sma50 = this.calculateSma(closes, 50);
    const sma200 = this.calculateSma(closes, 200);
    const rsi = this.calculateRsi(closes, 14);

    if (sma20 !== null) {
      target['SMA20'] = this.formatNumber(sma20);
    }
    if (sma50 !== null) {
      target['SMA50'] = this.formatNumber(sma50);
    }
    if (sma200 !== null) {
      target['SMA200'] = this.formatNumber(sma200);
    }
    if (rsi !== null) {
      target['RSI'] = this.formatNumber(rsi);
    }
  }

  private calculateSma(values: number[], period: number): number | null {
    if (values.length < period) {
      return null;
    }
    const window = values.slice(-period);
    return window.reduce((sum, value) => sum + value, 0) / period;
  }

  private calculateRsi(values: number[], period: number): number | null {
    if (values.length <= period) {
      return null;
    }

    let gains = 0;
    let losses = 0;
    for (let index = values.length - period; index < values.length; index += 1) {
      const delta = values[index] - values[index - 1];
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

  private normalizeChart(payload: Record<string, unknown>): PricePoint[] {
    const prices = payload['prices'];
    if (!Array.isArray(prices)) {
      return [];
    }

    return prices
      .map((entry) => {
        if (!Array.isArray(entry) || entry.length < 2) {
          return null;
        }
        const time = Number(entry[0]);
        const price = Number(entry[1]);
        return Number.isFinite(time) && Number.isFinite(price) ? { time, price } : null;
      })
      .filter((point): point is PricePoint => point !== null)
      .sort((a, b) => a.time - b.time);
  }

  private findPointAtOrBefore(points: PricePoint[], targetTime: number): PricePoint | null {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      if (point.time <= targetTime) {
        return point;
      }
    }
    return null;
  }

  private fallbackYearBase(points: PricePoint[], latest: PricePoint): PricePoint | null {
    const first = points[0];
    if (!first) {
      return null;
    }

    const diffDays = Math.abs(latest.time - first.time) / (24 * 60 * 60 * 1000);
    return diffDays >= 350 && diffDays <= 410 ? first : null;
  }

  private lastPointsWithin(points: PricePoint[], days: number): PricePoint[] {
    if (!points.length) {
      return [];
    }
    const latestTime = points[points.length - 1].time;
    const cutoff = latestTime - (days * 24 * 60 * 60 * 1000);
    return points.filter((point) => point.time >= cutoff);
  }

  private shiftTime(time: number, days: number): number {
    return time + (days * 24 * 60 * 60 * 1000);
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const search = new URLSearchParams(params);
    return `${BASE_URL}${path}?${search.toString()}`;
  }

  private async fetchJson<T>(url: string, apiKey: string): Promise<T> {
    const headers: HeadersInit = apiKey.trim()
      ? { 'x-cg-pro-api-key': apiKey.trim() }
      : {};
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(value);
  }

  private formatPercent(value: number): string {
    return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value * 100)}%`;
  }
}
