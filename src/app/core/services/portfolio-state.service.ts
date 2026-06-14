import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PortfolioDataset, PortfolioSummary } from '../models/portfolio.models';
import { WorkbookSnapshot } from '../models/workbook.models';
import { CombinedAlert } from './alert-mapper.service';
import { ChartPoint, SeriesPoint } from './chart-data.service';

export interface PortfolioAppState {
  status: 'empty' | 'loading' | 'ready' | 'warning' | 'error';
  fileName: string | null;
  workbook: WorkbookSnapshot | null;
  dataset: PortfolioDataset | null;
  summary: PortfolioSummary | null;
  combinedAlerts: CombinedAlert[];
  charts: {
    symbolDistribution: ChartPoint[];
    currencyDistribution: ChartPoint[];
    positionTypeDistribution: ChartPoint[];
    assetTypeDistribution: ChartPoint[];
    sectorDistribution: ChartPoint[];
    subsectorDistribution: ChartPoint[];
    regionDistribution: ChartPoint[];
    balanceSeries: SeriesPoint[];
    priceSeries: SeriesPoint[];
  };
  validationErrors: string[];
  validationWarnings: string[];
}

const initialState: PortfolioAppState = {
  status: 'empty',
  fileName: null,
  workbook: null,
  dataset: null,
  summary: null,
  combinedAlerts: [],
  charts: {
    symbolDistribution: [],
    currencyDistribution: [],
    positionTypeDistribution: [],
    assetTypeDistribution: [],
    sectorDistribution: [],
    subsectorDistribution: [],
    regionDistribution: [],
    balanceSeries: [],
    priceSeries: []
  },
  validationErrors: [],
  validationWarnings: []
};

@Injectable({ providedIn: 'root' })
export class PortfolioStateService {
  private readonly subject = new BehaviorSubject<PortfolioAppState>(initialState);
  readonly state$ = this.subject.asObservable();

  get snapshot(): PortfolioAppState {
    return this.subject.value;
  }

  setLoading(fileName: string): void {
    this.subject.next({
      ...initialState,
      status: 'loading',
      fileName
    });
  }

  setReady(state: PortfolioAppState): void {
    this.subject.next(state);
  }

  setError(message: string): void {
    this.subject.next({
      ...initialState,
      status: 'error',
      validationErrors: [message]
    });
  }

  reset(): void {
    this.subject.next(initialState);
  }
}
