import { TestBed } from '@angular/core/testing';

import { MinimumPerformanceBySymbol, MinimumPerformanceSummary } from '../models/minimum-performance.model';
import { buildClassification, buildMonthlySummary, buildPortfolioAppState, buildPortfolioPosition, buildWorkbookSnapshot, buildWorkbookTable } from '../testing/portfolio-test-builders';
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

  it('prefers TablaCalendario over backup benchmark sources in historical debug reports', () => {
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
        positions: [
          buildPortfolioPosition({
            symbol: 'AAA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 10,
            totalInvested: 1000,
            currentValue: 1300
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 130 }
        ],
        dailyBalances: [],
        classifications: [buildClassification({ symbol: 'AAA', type: 'Accion' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 105, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 200, source: 'TablaCalendarioRem' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 210, source: 'TablaCalendarioRem' },
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 300, source: 'TablaCalendarioInf' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 310, source: 'TablaCalendarioInf' }
        ]
      },
      summary: null,
      workbook: null
    });

    const trend = service.buildTrend(snapshot);
    const debug = service.debugMinimumBalanceTrendForDate(snapshot, '2025-01-31');

    expect(trend.points.length).toBe(1);
    expect(debug.benchmarkSourceSelected).toBe('TablaCalendario');
    expect(debug.benchmarkSourcesAvailable).toEqual(jasmine.arrayContaining(['TablaCalendario', 'TablaCalendarioRem', 'TablaCalendarioInf']));
    expect(trend.warnings.some((warning) => warning.includes('respaldo de calendario'))).toBeFalse();
  });

  it('falls back to TablaCalendarioRem and TablaCalendarioInf when TablaCalendario is missing', () => {
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

    const remSnapshot = buildPortfolioAppState({
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
        positions: [
          buildPortfolioPosition({
            symbol: 'AAA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 10,
            totalInvested: 1000,
            currentValue: 1300
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 130 }
        ],
        dailyBalances: [],
        classifications: [buildClassification({ symbol: 'AAA', type: 'Accion' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 200, source: 'TablaCalendarioRem' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 210, source: 'TablaCalendarioRem' },
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 300, source: 'TablaCalendarioInf' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 310, source: 'TablaCalendarioInf' }
        ]
      },
      summary: null,
      workbook: null
    });

    const remTrend = service.buildTrend(remSnapshot);
    const remDebug = service.debugMinimumBalanceTrendForDate(remSnapshot, '2025-01-31');

    expect(remTrend.points.length).toBe(1);
    expect(remDebug.benchmarkSourceSelected).toBe('TablaCalendarioRem');
    expect(remTrend.warnings.some((warning) => warning.includes('TablaCalendarioRem como respaldo'))).toBeTrue();

    const infSnapshot = buildPortfolioAppState({
      dataset: {
        operations: remSnapshot.dataset?.operations ?? [],
        sales: [],
        investmentMovements: [],
        positions: remSnapshot.dataset?.positions ?? [],
        historicalPrices: remSnapshot.dataset?.historicalPrices ?? [],
        dailyBalances: [],
        classifications: remSnapshot.dataset?.classifications ?? [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: remSnapshot.dataset?.monthlySummary ?? [],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 300, source: 'TablaCalendarioInf' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 310, source: 'TablaCalendarioInf' }
        ]
      },
      summary: null,
      workbook: null
    });

    const infTrend = service.buildTrend(infSnapshot);
    const infDebug = service.debugMinimumBalanceTrendForDate(infSnapshot, '2025-01-31');

    expect(infTrend.points.length).toBe(1);
    expect(infDebug.benchmarkSourceSelected).toBe('TablaCalendarioInf');
    expect(infTrend.warnings.some((warning) => warning.includes('TablaCalendarioInf como respaldo'))).toBeTrue();
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

  it('omits valuation-like FCI lots from the historical series and exposes them in debug', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 200,
      minimumExpectedArs: 180,
      balanceVsMinimumArs: 20,
      balanceVsMinimumPercentArs: 11.1111111111,
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
            quantity: 2,
            buyPrice: 90,
            total: 180,
            currentPrice: 100,
            currentValue: 200,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          },
          {
            id: '2',
            date: '2025-01-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 26924.72,
            buyPrice: 10,
            total: 295245.403019649,
            currentPrice: 10,
            currentValue: 295245.403019649,
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
        positions: [
          buildPortfolioPosition({
            symbol: 'AAA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 2,
            totalInvested: 180,
            currentValue: 200
          }),
          buildPortfolioPosition({
            symbol: 'IOLCAMA',
            currency: 'ARS',
            positionType: 'Valorizado',
            assetType: 'FCI',
            quantity: 26924.72,
            totalInvested: 295245.403019649,
            currentValue: 295245.403019649
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 100 },
          { date: '2025-01-31', month: 'ene-25', symbol: 'IOLCAMA', price: 1298834.747902916 }
        ],
        dailyBalances: [],
        classifications: [
          buildClassification({ symbol: 'AAA', type: 'Accion' }),
          buildClassification({ symbol: 'IOLCAMA', type: 'FCI' })
        ],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const trend = service.buildTrend(snapshot);
    const debug = service.debugMinimumBalanceTrendForDate(snapshot, '2025-01-31');
    const suspicious = service.debugMinimumBalanceTrendSuspiciousLots(snapshot, '2025-01-31');

    expect(trend.points.length).toBe(1);
    expect(trend.points[0].comparableValueARS).toBe(200);
    expect(trend.points[0].minimumExpectedARS).toBe(180);
    expect(trend.warnings.some((warning) => warning.includes('FCI/valor valorizado omitido en hist'))).toBeTrue();
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && lot.skipReason === 'valuation-like-instrument')).toBeTrue();
    expect(suspicious.lots.some((lot) => lot.symbol === 'IOLCAMA')).toBeTrue();
  });

  it('keeps USD lots excluded from the ARS historical series', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 200,
      minimumExpectedArs: 180,
      balanceVsMinimumArs: 20,
      balanceVsMinimumPercentArs: 11.1111111111,
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
            symbol: 'BTC',
            currency: 'USD',
            quantity: 1,
            buyPrice: 100,
            total: 100,
            currentPrice: 100,
            currentValue: 100,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          },
          {
            id: '2',
            date: '2025-01-01',
            symbol: 'AAA',
            currency: 'ARS',
            quantity: 2,
            buyPrice: 90,
            total: 180,
            currentPrice: 100,
            currentValue: 200,
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
        positions: [
          buildPortfolioPosition({
            symbol: 'BTC',
            currency: 'USD',
            positionType: 'Cripto',
            assetType: 'Cripto',
            quantity: 1,
            totalInvested: 100,
            currentValue: 100
          }),
          buildPortfolioPosition({
            symbol: 'AAA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 2,
            totalInvested: 180,
            currentValue: 200
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'BTC', price: 100 },
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 100 }
        ],
        dailyBalances: [],
        classifications: [
          buildClassification({ symbol: 'BTC', type: 'Cripto' }),
          buildClassification({ symbol: 'AAA', type: 'Accion' })
        ],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const trend = service.buildTrend(snapshot);
    const debug = service.debugMinimumBalanceTrendForDate(snapshot, '2025-01-31');

    expect(trend.points.length).toBe(1);
    expect(trend.points[0].comparableValueARS).toBe(200);
    expect(debug.lots.some((lot) => lot.symbol === 'BTC' && lot.skipReason === 'unsupported-currency')).toBeTrue();
  });

  it('detects FCI symbols from Tabla11 and skips them in the historical series', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 200,
      minimumExpectedArs: 180,
      balanceVsMinimumArs: 20,
      balanceVsMinimumPercentArs: 11.1111111111,
      status: 'positive',
      description: 'ok',
      notes: []
    });
    minimumPerformance.buildMinimumPerformanceBySymbol.and.returnValue([]);

    const snapshot = buildPortfolioAppState({
      workbook: buildWorkbookSnapshot({
        tables: [
          buildWorkbookTable({
            name: 'Tabla11',
            displayName: 'Tabla11',
            rows: [
              { 'Fondos com. Inv.': 'IOLCAMA' }
            ],
            columns: ['Fondos com. Inv.'],
            rowCount: 1
          })
        ]
      }),
      dataset: {
        operations: [
          {
            id: '1',
            date: '2025-01-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 2,
            buyPrice: 90,
            total: 180,
            currentPrice: 100,
            currentValue: 200,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          },
          {
            id: '2',
            date: '2025-01-01',
            symbol: 'AAA',
            currency: 'ARS',
            quantity: 2,
            buyPrice: 90,
            total: 180,
            currentPrice: 100,
            currentValue: 200,
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
        positions: [
          buildPortfolioPosition({
            symbol: 'IOLCAMA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 2,
            totalInvested: 180,
            currentValue: 200
          }),
          buildPortfolioPosition({
            symbol: 'AAA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 2,
            totalInvested: 180,
            currentValue: 200
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'IOLCAMA', price: 1298834.747902916 },
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 100 }
        ],
        dailyBalances: [],
        classifications: [
          buildClassification({ symbol: 'IOLCAMA', type: 'Accion' }),
          buildClassification({ symbol: 'AAA', type: 'Accion' })
        ],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null
    });

    const trend = service.buildTrend(snapshot);
    const debug = service.debugMinimumBalanceTrendForDate(snapshot, '2025-01-31');

    expect(trend.points.length).toBe(1);
    expect(trend.points[0].comparableValueARS).toBe(200);
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && lot.skipReason === 'valuation-like-instrument')).toBeTrue();
    expect(trend.warnings.some((warning) => warning.includes('FCI/valor valorizado omitido'))).toBeTrue();
  });

  it('skips non-comparable instruments like CAUCION in the historical series', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 200,
      minimumExpectedArs: 180,
      balanceVsMinimumArs: 20,
      balanceVsMinimumPercentArs: 11.1111111111,
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
            symbol: 'CAUCION',
            currency: 'ARS',
            quantity: 2,
            buyPrice: 90,
            total: 180,
            currentPrice: 100,
            currentValue: 200,
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
        positions: [
          buildPortfolioPosition({
            symbol: 'CAUCION',
            currency: 'ARS',
            positionType: 'Caucion',
            assetType: 'Caucion',
            quantity: 2,
            totalInvested: 180,
            currentValue: 200
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'CAUCION', price: 100 }
        ],
        dailyBalances: [],
        classifications: [
          buildClassification({ symbol: 'CAUCION', type: 'Caucion' })
        ],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null
    });

    const trend = service.buildTrend(snapshot);
    const debug = service.debugMinimumBalanceTrendSkippedLots(snapshot, '2025-01-31');

    expect(trend.points.length).toBe(0);
    expect(debug.skippedLots.some((lot) => lot.symbol === 'CAUCION' && lot.skipReason === 'non-comparable-instrument')).toBeTrue();
    expect(debug.skippedByReason['non-comparable-instrument']).toBe(1);
  });

  it('reports the comparison against the current calculation and omitted reasons', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 200,
      minimumExpectedArs: 180,
      balanceVsMinimumArs: 20,
      balanceVsMinimumPercentArs: 11.1111111111,
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
            quantity: 2,
            buyPrice: 90,
            total: 180,
            currentPrice: 100,
            currentValue: 200,
            variation: null,
            remVariation: null,
            remValue: null,
            amount: null,
            monthlyRate: null,
            annualRate: null,
            top: null,
            trend: null
          },
          {
            id: '2',
            date: '2025-01-01',
            symbol: 'BTC',
            currency: 'USD',
            quantity: 1,
            buyPrice: 100,
            total: 100,
            currentPrice: 100,
            currentValue: 100,
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
        positions: [
          buildPortfolioPosition({
            symbol: 'AAA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 2,
            totalInvested: 180,
            currentValue: 200
          }),
          buildPortfolioPosition({
            symbol: 'BTC',
            currency: 'USD',
            positionType: 'Cripto',
            assetType: 'Cripto',
            quantity: 1,
            totalInvested: 100,
            currentValue: 100
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 100 },
          { date: '2025-01-31', month: 'ene-25', symbol: 'BTC', price: 100 }
        ],
        dailyBalances: [],
        classifications: [
          buildClassification({ symbol: 'AAA', type: 'Accion' }),
          buildClassification({ symbol: 'BTC', type: 'Cripto' })
        ],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null
    });

    const report = service.debugMinimumBalanceTrendCurrentComparison(snapshot);

    expect(report.current.balanceVsMinimumARS).toBe(20);
    expect(report.lastHistoricalPoint.date).toBe('2025-01-31');
    expect(report.difference.balanceVsMinimumARS).toBe(0);
    expect(report.omittedByReason['unsupported-currency']).toBe(1);
    expect(report.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it('warns when the historical benchmark source differs from the current one', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 200,
      minimumExpectedArs: 180,
      balanceVsMinimumArs: 20,
      balanceVsMinimumPercentArs: 11.1111111111,
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
            quantity: 2,
            buyPrice: 90,
            total: 180,
            currentPrice: 100,
            currentValue: 200,
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
        positions: [
          buildPortfolioPosition({
            symbol: 'AAA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 2,
            totalInvested: 180,
            currentValue: 200
          })
        ],
        historicalPrices: [
          { date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 100 }
        ],
        dailyBalances: [],
        classifications: [buildClassification({ symbol: 'AAA', type: 'Accion' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'ene-25', year: 2025 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2025, 0, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    let resolveCallCount = 0;
    spyOn<any>(service as any, 'resolveBenchmarkRows').and.callFake(() => {
      resolveCallCount += 1;
      if (resolveCallCount <= 2) {
        return {
          rows: [
            { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
          ],
          source: 'TablaCalendario',
          availableSources: ['TablaCalendario', 'TablaCalendarioRem'],
          notes: []
        };
      }

      return {
        rows: [
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendarioRem' }
        ],
        source: 'TablaCalendarioRem',
        availableSources: ['TablaCalendario', 'TablaCalendarioRem'],
        notes: ['Se utilizo TablaCalendarioRem como respaldo de calendario.']
      };
    });

    const report = service.debugMinimumBalanceTrendCurrentComparison(snapshot);

    expect(report.benchmarkSourceActual).toBe('TablaCalendario');
    expect(report.benchmarkSourceHistorical).toBe('TablaCalendarioRem');
    expect(report.warnings).toContain('El histórico usa una fuente de benchmark distinta al cálculo actual.');
  });
});
