import { TestBed } from '@angular/core/testing';

import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';
import { InvestmentMovementsPerformanceService } from './investment-movements-performance.service';
import { MinimumPerformanceService } from './minimum-performance.service';
import { PrivacyModeService } from './privacy-mode.service';
import { buildPortfolioAppState } from '../testing/portfolio-test-builders';

describe('MinimumPerformanceService', () => {
  const privacyMode = { enabled: false };
  let service: MinimumPerformanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CurrencyMapperService,
        DataNormalizationService,
        InvestmentMovementsPerformanceService,
        MinimumPerformanceService,
        {
          provide: PrivacyModeService,
          useValue: privacyMode
        }
      ]
    });
    service = TestBed.inject(MinimumPerformanceService);
  });

  it('calculates the minimum benchmark using comparable ARS lots', () => {
    const snapshot = buildPortfolioAppState({
      dataset: {
        operations: [
          {
            id: '1',
            date: '2025-01-02',
            symbol: 'TX26',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 100,
            total: 1000,
            currentPrice: 120,
            currentValue: 1200,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          }
        ],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 11, 31)), tna: 12, dailyReturnPercent: 0.01, index: 120, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const summary = service.buildMinimumPerformanceSummary(snapshot);
    const bySymbol = service.buildMinimumPerformanceBySymbol(snapshot);

    expect(summary.status).toBe('neutral');
    expect(summary.currentComparableArs).toBe(1200);
    expect(summary.minimumExpectedArs).toBe(1200);
    expect(summary.balanceVsMinimumArs).toBe(0);
    expect(summary.balanceVsMinimumPercentArs).toBe(0);
    expect(bySymbol.length).toBe(1);
    expect(bySymbol[0].symbol).toBe('TX26');
    expect(bySymbol[0].minimumExpectedValue).toBe(1200);
    expect(bySymbol[0].valueVsMinimumAmount).toBe(0);
    expect(bySymbol[0].status).toBe('beats-minimum');
  });

  it('adjusts the benchmark when amortization movements reduce exposed capital', () => {
    const snapshot = buildPortfolioAppState({
      dataset: {
        operations: [
          {
            id: '1',
            date: '2025-01-02',
            symbol: 'TX26',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 100,
            total: 1000,
            currentPrice: 50,
            currentValue: 500,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          }
        ],
        sales: [],
        investmentMovements: [
          {
            date: new Date(Date.UTC(2025, 5, 1)),
            symbol: 'TX26',
            currency: 'ARS',
            type: 'Amortizacion',
            amount: 100,
            affectsPerformance: false,
            affectsInvestedCapital: true,
            capitalEffect: 'reduces-cost',
            note: 'Capital devuelto'
          }
        ],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 110, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 11, 31)), tna: 12, dailyReturnPercent: 0.01, index: 120, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const bySymbol = service.buildMinimumPerformanceBySymbol(snapshot);

    expect(bySymbol[0].usesAmortizationAdjustedBenchmark).toBeTrue();
    expect(bySymbol[0].minimumExpectedValueRaw).toBe(1200);
    expect(bySymbol[0].minimumExpectedValueAdjusted).toBeLessThan(1200);
    expect(bySymbol[0].currentValue).toBe(500);
    expect(bySymbol[0].marketCurrentValue).toBe(500);
  });

  it('returns controlled missing data for zero benchmark or unsupported currencies', () => {
    const snapshot = buildPortfolioAppState({
      dataset: {
        operations: [
          {
            id: '1',
            date: '2025-01-02',
            symbol: 'TX26',
            currency: 'USD',
            quantity: 10,
            buyPrice: 100,
            total: 1000,
            currentPrice: 120,
            currentValue: 1200,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          }
        ],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      summary: null,
      workbook: null
    });

    const summary = service.buildMinimumPerformanceSummary(snapshot);
    const bySymbol = service.buildMinimumPerformanceBySymbol(snapshot);

    expect(summary.status).toBe('missing');
    expect(summary.minimumExpectedArs).toBeNull();
    expect(summary.balanceVsMinimumPercentArs).toBeNull();
    expect(bySymbol[0].status).toBe('not-applicable');
    expect(bySymbol[0].minimumExpectedValue).toBeNull();
  });

  it('returns missing calendar status when no benchmark rows are available', () => {
    const snapshot = buildPortfolioAppState({
      dataset: {
        operations: [
          {
            id: '1',
            date: '2025-01-02',
            symbol: 'TX26',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 100,
            total: 1000,
            currentPrice: 120,
            currentValue: 1200,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          }
        ],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      summary: null,
      workbook: null
    });

    const summary = service.buildMinimumPerformanceSummary(snapshot);
    const bySymbol = service.buildMinimumPerformanceBySymbol(snapshot);

    expect(summary.status).toBe('missing');
    expect(bySymbol[0].status).toBe('missing-calendar');
  });
});
