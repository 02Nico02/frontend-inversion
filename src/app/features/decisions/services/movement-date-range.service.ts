import { Injectable } from '@angular/core';
import { PortfolioAppState } from '../../../core/services/portfolio-state.service';
import { parseExcelDate } from '../../../core/utils/value-parsing.utils';

export type MovementRangePreset = '7d' | '15d' | '30d' | 'currentMonth' | 'custom';

export interface MovementDateRange {
  from: string | null;
  to: string | null;
  preset: MovementRangePreset;
}

export interface ParsedMovementDateRange {
  from: Date | null;
  to: Date | null;
}

@Injectable({ providedIn: 'root' })
export class MovementDateRangeService {
  getDefaultMovementRange(snapshot: PortfolioAppState): MovementDateRange {
    const to = this.latestAvailableDate(snapshot);
    if (!to) {
      return { from: null, to: null, preset: '7d' };
    }
    return this.applyMovementPreset('7d', to);
  }

  applyMovementPreset(preset: MovementRangePreset, currentToDate: string | Date | null | undefined): MovementDateRange {
    const to = this.normalizeDate(currentToDate);
    if (!to) {
      return { from: null, to: null, preset };
    }

    let from = new Date(to);
    switch (preset) {
      case '15d':
        from.setUTCDate(from.getUTCDate() - 15);
        break;
      case '30d':
        from.setUTCDate(from.getUTCDate() - 30);
        break;
      case 'currentMonth':
        from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
        break;
      case 'custom':
      case '7d':
      default:
        from.setUTCDate(from.getUTCDate() - 7);
        break;
    }

    return {
      from: this.formatDate(from),
      to: this.formatDate(to),
      preset
    };
  }

  parseMovementRange(range: MovementDateRange | null | undefined): ParsedMovementDateRange {
    if (!range) {
      return { from: null, to: null };
    }
    return {
      from: this.normalizeDate(range.from),
      to: this.normalizeDate(range.to)
    };
  }

  normalizeForSnapshot(range: MovementDateRange | null | undefined, snapshot: PortfolioAppState): MovementDateRange {
    const fallback = this.getDefaultMovementRange(snapshot);
    const bounds = this.availableBounds(snapshot);
    if (!bounds.from || !bounds.to) {
      return fallback;
    }

    const parsed = this.parseMovementRange(range);
    const preset = range?.preset ?? fallback.preset;
    if (!parsed.from || !parsed.to || parsed.from.getTime() > parsed.to.getTime()) {
      return fallback;
    }

    if (parsed.from.getTime() < bounds.from.getTime() || parsed.to.getTime() > bounds.to.getTime()) {
      return fallback;
    }

    return {
      from: this.formatDate(parsed.from),
      to: this.formatDate(parsed.to),
      preset
    };
  }

  latestAvailableDate(snapshot: PortfolioAppState): Date | null {
    const values = [
      ...(snapshot.dataset?.operations ?? []).map((item) => item.date),
      ...(snapshot.dataset?.sales ?? []).map((item) => item.sellDate ?? item.buyDate)
    ];
    const parsed = values
      .map((value) => this.normalizeDate(value))
      .filter((value): value is Date => value !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    return parsed.at(-1) ?? null;
  }

  availableBounds(snapshot: PortfolioAppState): { from: Date | null; to: Date | null } {
    const values = [
      ...(snapshot.dataset?.operations ?? []).map((item) => item.date),
      ...(snapshot.dataset?.sales ?? []).map((item) => item.sellDate ?? item.buyDate)
    ];
    const parsed = values
      .map((value) => this.normalizeDate(value))
      .filter((value): value is Date => value !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      from: parsed[0] ?? null,
      to: parsed.at(-1) ?? null
    };
  }

  labelForPreset(preset: MovementRangePreset): string {
    switch (preset) {
      case '15d':
        return 'Últimos 15 días';
      case '30d':
        return 'Últimos 30 días';
      case 'currentMonth':
        return 'Mes actual';
      case 'custom':
        return 'Personalizado';
      case '7d':
      default:
        return 'Últimos 7 días';
    }
  }

  formatRangeLabel(range: MovementDateRange | null | undefined): string {
    const parsed = this.parseMovementRange(range);
    if (!parsed.from || !parsed.to) {
      return 'N/D';
    }
    return `${this.formatDate(parsed.from)} → ${this.formatDate(parsed.to)}`;
  }

  private normalizeDate(value: string | Date | null | undefined): Date | null {
    const parsed = parseExcelDate(value);
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }

  private formatDate(value: Date): string {
    return `${String(value.getUTCDate()).padStart(2, '0')}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${value.getUTCFullYear()}`;
  }
}
