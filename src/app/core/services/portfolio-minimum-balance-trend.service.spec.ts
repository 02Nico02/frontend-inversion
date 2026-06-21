import { TestBed } from '@angular/core/testing';

import { MinimumPerformanceBySymbol, MinimumPerformanceSummary } from '../models/minimum-performance.model';
import { buildMonthlySummary, buildPortfolioAppState } from '../testing/portfolio-test-builders';
import { MinimumPerformanceService } from './minimum-performance.service';
import { PortfolioMinimumBalanceTrendService } from './portfolio-minimum-balance-trend.service';

describe('PortfolioMinimumBalanceTrendService', () => {
  let service: PortfolioMinimumBalanceTrendService;
  let minimumPerformance: jasmine.SpyObj<MinimumPerformanceService>;

  beforeEach(() => {
    minimumPerformance = jasmine.createSpyObj<MinimumPerformanceService>('MinimumPerformanceService', [
      'buildMinimumPerformanceSummary',
      'buildMinimumPerformanceBySymbol'
    ]);

    TestBed.configureTestingModule({
      providers: [
        PortfolioMinimumBalanceTrendService,
        { provide: MinimumPerformanceService, useValue: minimumPerformance }
      ]
    });

    service = TestBed.inject(PortfolioMinimumBalanceTrendService);
  });

  it('builds the current balance vs minimum state and counts positions below minimum', () => {
    const summary: MinimumPerformanceSummary = {
      currency: 'ARS',
      comparableLotsCount: 2,
      currentComparableArs: 1200,
      minimumExpectedArs: 1000,
      balanceVsMinimumArs: 200,
      balanceVsMinimumPercentArs: 20,
      status: 'positive',
      description: 'ok',
      notes: []
    };
    const bySymbol: MinimumPerformanceBySymbol[] = [
      {
        symbol: 'AAA',
        currency: 'ARS',
        lotsCount: 1,
        investedAmount: 1000,
        currentValue: 900,
        marketCurrentValue: 900,
        comparableValue: 900,
        usesAdjustedComparableValue: false,
        incomeAmount: 0,
        capitalReturnedAmount: 0,
        minimumExpectedValueRaw: 1000,
        minimumExpectedValueAdjusted: 1000,
        usesAmortizationAdjustedBenchmark: false,
        benchmarkAccruedAmount: null,
        remainingExposedCapital: null,
        minimumExpectedValue: 1000,
        valueVsMinimumAmount: -100,
        valueVsMinimumPercent: -10,
        status: 'below-minimum',
        lots: [],
        notes: []
      },
      {
        symbol: 'BBB',
        currency: 'ARS',
        lotsCount: 1,
        investedAmount: 1000,
        currentValue: 1300,
        marketCurrentValue: 1300,
        comparableValue: 1300,
        usesAdjustedComparableValue: false,
        incomeAmount: 0,
        capitalReturnedAmount: 0,
        minimumExpectedValueRaw: 1000,
        minimumExpectedValueAdjusted: 1000,
        usesAmortizationAdjustedBenchmark: false,
        benchmarkAccruedAmount: null,
        remainingExposedCapital: null,
        minimumExpectedValue: 1000,
        valueVsMinimumAmount: 300,
        valueVsMinimumPercent: 30,
        status: 'beats-minimum',
        lots: [],
        notes: []
      },
      {
        symbol: 'USD1',
        currency: 'USD',
        lotsCount: 1,
        investedAmount: 1000,
        currentValue: 1200,
        marketCurrentValue: 1200,
        comparableValue: 1200,
        usesAdjustedComparableValue: false,
        incomeAmount: 0,
        capitalReturnedAmount: 0,
        minimumExpectedValueRaw: null,
        minimumExpectedValueAdjusted: null,
        usesAmortizationAdjustedBenchmark: false,
        benchmarkAccruedAmount: null,
        remainingExposedCapital: null,
        minimumExpectedValue: null,
        valueVsMinimumAmount: null,
        valueVsMinimumPercent: null,
        status: 'not-applicable',
        lots: [],
        notes: []
      }
    ];

    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue(summary);
    minimumPerformance.buildMinimumPerformanceBySymbol.and.returnValue(bySymbol);

    const trend = service.buildTrend(buildPortfolioAppState());

    expect(trend.currentBalanceVsMinimumARS).toBe(200);
    expect(trend.currentBalanceVsMinimumPercent).toBe(20);
    expect(trend.positionsBelowMinimumCount).toBe(1);
    expect(trend.totalDeficitBelowMinimumARS).toBe(100);
    expect(trend.bestHistoricalBalanceARS).toBeNull();
    expect(trend.worstHistoricalBalanceARS).toBeNull();
    expect(trend.points).toEqual([]);
    expect(trend.trendStatus).toBe('not-available');
    expect(trend.trendLabel).toBe('Sin historial suficiente');
    expect(trend.warnings).toContain('No hay serie histórica confiable de Balance vs mínimo ARS.');
  });

  it('returns a controlled empty trend when there is no historical series', () => {
    const summary: MinimumPerformanceSummary = {
      currency: 'ARS',
      comparableLotsCount: 0,
      currentComparableArs: null,
      minimumExpectedArs: null,
      balanceVsMinimumArs: null,
      balanceVsMinimumPercentArs: null,
      status: 'missing',
      description: 'missing',
      notes: ['No data']
    };

    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue(summary);
    minimumPerformance.buildMinimumPerformanceBySymbol.and.returnValue([]);

    const trend = service.buildTrend(buildPortfolioAppState());

    expect(trend.currentBalanceVsMinimumARS).toBeNull();
    expect(trend.currentBalanceVsMinimumPercent).toBeNull();
    expect(trend.positionsBelowMinimumCount).toBe(0);
    expect(trend.totalDeficitBelowMinimumARS).toBe(0);
    expect(trend.points).toEqual([]);
    expect(trend.trendStatus).toBe('not-available');
  });

  it('builds a monthly historical series from open ARS lots', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 1200,
      minimumExpectedArs: 1000,
      balanceVsMinimumArs: 200,
      balanceVsMinimumPercentArs: 20,
      status: 'positive',
      description: 'ok',
      notes: []
    });
    minimumPerformance.buildMinimumPerformanceBySymbol.and.returnValue([]);

    const snapshot = buildPortfolioAppState({
      dataset: {
        operations: [
          {
            id: '1',
            date: '2025-01-01',
            symbol: 'AAA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 100,
            total: 1000,
            currentPrice: 130,
            currentValue: 1300,
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
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 120 },
          { date: '2025-02-28', month: 'feb-25', symbol: 'AAA', price: 132 }
        ],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'ene-25', year: 2025 }),
          buildMonthlySummary({ month: 'feb-25', year: 2025 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 1, 28)), tna: 10, dailyReturnPercent: 0.01, index: 110, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const trend = service.buildTrend(snapshot);

    expect(trend.points.length).toBe(2);
    const firstDate = trend.points[0].date;
    const secondDate = trend.points[1].date;
    expect(firstDate instanceof Date).toBeTrue();
    expect(secondDate instanceof Date).toBeTrue();
    expect((firstDate as Date).getUTCFullYear()).toBe(2025);
    expect((firstDate as Date).getUTCMonth()).toBe(0);
    expect((secondDate as Date).getUTCMonth()).toBe(1);
    expect(trend.points[0].balanceVsMinimumARS).toBeGreaterThan(0);
    expect(trend.points[1].balanceVsMinimumARS).toBeGreaterThan(0);
    expect(trend.bestHistoricalBalanceARS).toBeGreaterThan(0);
    expect(trend.worstHistoricalBalanceARS).toBeGreaterThan(0);
    expect(trend.trendStatus).toBe('stable');
  });

  it('includes sold lots only until their sale date', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 0,
      currentComparableArs: null,
      minimumExpectedArs: null,
      balanceVsMinimumArs: null,
      balanceVsMinimumPercentArs: null,
      status: 'missing',
      description: 'missing',
      notes: []
    });
    minimumPerformance.buildMinimumPerformanceBySymbol.and.returnValue([]);

    const snapshot = buildPortfolioAppState({
      dataset: {
        operations: [],
        sales: [
          {
            id: '1',
            buyDate: '2025-01-01',
            sellDate: '2025-02-15',
            symbol: 'AAA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 100,
            total: 1000,
            sellPrice: 130,
            currentValue: 0,
            variation: null,
            amount: null,
            minimumObjective: null
          }
        ],
        investmentMovements: [],
        positions: [],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 120 },
          { date: '2025-02-28', month: 'feb-25', symbol: 'AAA', price: 130 },
          { date: '2025-03-31', month: 'mar-25', symbol: 'AAA', price: 140 }
        ],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'ene-25', year: 2025 }),
          buildMonthlySummary({ month: 'feb-25', year: 2025 }),
          buildMonthlySummary({ month: 'mar-25', year: 2025 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 1, 28)), tna: 10, dailyReturnPercent: 0.01, index: 110, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 2, 31)), tna: 10, dailyReturnPercent: 0.01, index: 120, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const trend = service.buildTrend(snapshot);

    expect(trend.points.length).toBe(1);
    expect(trend.points[0].date instanceof Date).toBeTrue();
    expect(trend.points[0].balanceVsMinimumARS).toBe(200);
  });
});
