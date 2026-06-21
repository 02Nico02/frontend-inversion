import { TestBed } from '@angular/core/testing';

import { MinimumPerformanceBySymbol, MinimumPerformanceSummary } from '../models/minimum-performance.model';
import { buildPortfolioAppState } from '../testing/portfolio-test-builders';
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
});
