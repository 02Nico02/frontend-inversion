import { Injectable } from '@angular/core';

export interface PositionsFilterState {
  symbol: string;
  currency: string;
  assetType: string;
  sector: string;
  subsector: string;
  region: string;
  resultDirection: 'all' | 'positive' | 'negative';
  alerts: 'all' | 'with' | 'without';
  classification: 'all' | 'with' | 'without';
  sortField: 'symbol' | 'resultAmount' | 'resultPercent' | 'currentValue' | 'portfolioWeight';
  sortDirection: 'asc' | 'desc';
  pageSize: 10 | 25 | 50 | 'all';
  pageIndex: number;
  advancedOpen: boolean;
}

const STORAGE_KEY = 'frontend-inversion.positions-filters';

const defaultState: PositionsFilterState = {
  symbol: '',
  currency: '',
  assetType: '',
  sector: '',
  subsector: '',
  region: '',
  resultDirection: 'all',
  alerts: 'all',
  classification: 'all',
  sortField: 'currentValue',
  sortDirection: 'desc',
  pageSize: 10,
  pageIndex: 0,
  advancedOpen: false
};

@Injectable({ providedIn: 'root' })
export class PositionsFilterStateService {
  private state: PositionsFilterState = this.read();

  get snapshot(): PositionsFilterState {
    return { ...this.state };
  }

  update(patch: Partial<PositionsFilterState>): void {
    this.state = { ...this.state, ...patch };
    this.write();
  }

  reset(): void {
    this.state = { ...defaultState };
    this.write();
  }

  private read(): PositionsFilterState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaultState };
      return { ...defaultState, ...JSON.parse(raw) };
    } catch {
      return { ...defaultState };
    }
  }

  private write(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore storage errors
    }
  }
}
