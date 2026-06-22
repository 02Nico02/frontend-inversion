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

  it('includes FCI lots using Tabla5 direct value and segment base', () => {
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
    expect(trend.points[0].comparableValueARS).toBeGreaterThan(200);
    expect(trend.points[0].minimumExpectedARS).toBeGreaterThan(180);
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && !lot.skipped)).toBeTrue();
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && lot.marketValueRule === 'fci-direct-value')).toBeTrue();
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && lot.skipReason === 'missing-invested-amount')).toBeFalse();
    expect(suspicious.lots.some((lot) => lot.symbol === 'IOLCAMA')).toBeFalse();
  });

  it('keeps an FCI included using the reconstructed capital when there are no sales before the evaluation date', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 806791.91,
      minimumExpectedArs: 806791.91,
      balanceVsMinimumArs: 0,
      balanceVsMinimumPercentArs: 0,
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
            rows: [{ 'Fondos com. Inv.': 'IOLCAMA' }],
            columns: ['Fondos com. Inv.'],
            rowCount: 1
          })
        ]
      }),
      dataset: {
        operations: [
          {
            id: 'op-182',
            date: '2026-06-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 26924.72,
            buyPrice: 10,
            total: 295245.403019649,
            currentPrice: 806791.91,
            currentValue: 806791.91,
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
        sales: [
          {
            id: 'sale-67',
            buyDate: '2026-06-01',
            sellDate: '2026-06-30',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 26924.72,
            buyPrice: 10,
            total: 295245.403019649,
            sellPrice: 10,
            totalSold: 295245.403019649,
            amount: 0,
            price: 10,
            currentPrice: 10
          }
        ],
        investmentMovements: [],
        positions: [
          buildPortfolioPosition({
            symbol: 'IOLCAMA',
            currency: 'ARS',
            positionType: 'Valorizado',
            assetType: 'FCI',
            quantity: 26924.72,
            totalInvested: 295245.403019649,
            currentValue: 806791.91
          })
        ],
        historicalPrices: [{ date: '2026-06-09', month: 'jun-26', symbol: 'IOLCAMA', price: 806791.91 }],
        dailyBalances: [{ date: '2026-06-09', month: 'jun-26', balance: 0 }],
        classifications: [buildClassification({ symbol: 'IOLCAMA', type: 'FCI' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 9)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const report = service.buildTrendBySymbol(snapshot, 'IOLCAMA', 'daily');
    const debug = service.debugMinimumBalanceTrendForSymbolAtDate(snapshot, 'IOLCAMA', '2026-06-09');

    expect(report.points.length).toBe(1);
    expect(report.points[0].meta?.included).toBeTrue();
    expect(report.points[0].meta?.marketValue).toBeCloseTo(806791.91, 2);
    expect(report.points[0].meta?.minimumExpectedARS).toBeCloseTo(295245.403019649, 2);
    expect(debug.included).toBeTrue();
    expect(debug.marketValue).toBeCloseTo(806791.91, 2);
    expect(debug.minimumExpectedUsed).toBeCloseTo(295245.403019649, 2);
    expect(debug.baseCapitalSource).toBe('Tabla6+Tabla13 eventos históricos');
    expect(debug.skipReason).toBeNull();
  });

  it('reduces the benchmark balance proportionally when an FCI sale occurs before the evaluation date', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 1560,
      minimumExpectedArs: 1560,
      balanceVsMinimumArs: 0,
      balanceVsMinimumPercentArs: 0,
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
            rows: [{ 'Fondos com. Inv.': 'IOLCAMA' }],
            columns: ['Fondos com. Inv.'],
            rowCount: 1
          })
        ]
      }),
      dataset: {
        operations: [
          {
            id: 'op-1',
            date: '2026-04-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 1,
            buyPrice: 1600,
            total: 1600,
            currentPrice: 1560,
            currentValue: 1560,
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
        sales: [
          {
            id: 'sale-1',
            buyDate: '2026-04-01',
            sellDate: '2026-05-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 0.25,
            buyPrice: 1600,
            total: 400,
            sellPrice: 1600,
            totalSold: 400,
            amount: 0,
            price: 1600,
            currentPrice: 400
          }
        ],
        investmentMovements: [],
        positions: [
          buildPortfolioPosition({
            symbol: 'IOLCAMA',
            currency: 'ARS',
            positionType: 'Valorizado',
            assetType: 'FCI',
            quantity: 1,
            totalInvested: 1600,
            currentValue: 1560
          })
        ],
        historicalPrices: [{ date: '2026-06-01', month: 'jun-26', symbol: 'IOLCAMA', price: 1560 }],
        dailyBalances: [{ date: '2026-06-01', month: 'jun-26', balance: 0 }],
        classifications: [buildClassification({ symbol: 'IOLCAMA', type: 'FCI' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 3, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 4, 1)), tna: 10, dailyReturnPercent: 0.01, index: 120, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 130, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const debug = service.debugMinimumBalanceTrendForSymbolAtDate(snapshot, 'IOLCAMA', '2026-06-01');
    const saleEvent = debug.fciCapitalEvents?.find((event) => event.type === 'sell') ?? null;

    expect(debug.included).toBeTrue();
    expect(debug.capitalOriginalReconstruido).toBeCloseTo(1600, 2);
    expect(debug.capitalExpuestoCosto).toBeCloseTo(1200, 2);
    expect(saleEvent?.soldShare).toBeCloseTo(0.25, 2);
    expect(saleEvent?.minimumExpectedRemoved).toBeCloseTo(480, 2);
    expect(saleEvent?.benchmarkIndexBeforeEvent).toBeCloseTo(100, 2);
    expect(saleEvent?.benchmarkIndexAtEvent).toBeCloseTo(120, 2);
    expect(saleEvent?.benchmarkBalanceBeforeEvent).toBeCloseTo(1920, 2);
    expect(saleEvent?.benchmarkBalanceAfterEvent).toBeCloseTo(1440, 2);
    expect(debug.minimumExpectedUsed).toBeCloseTo(1560, 2);
    expect(debug.balanceVsMinimum).toBeCloseTo(0, 2);
  });

  it('skips an FCI with no Tabla5 historical price', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 0,
      minimumExpectedArs: 0,
      balanceVsMinimumArs: 0,
      balanceVsMinimumPercentArs: 0,
      status: 'missing',
      description: 'missing',
      notes: []
    });
    minimumPerformance.buildMinimumPerformanceBySymbol.and.returnValue([]);

    const snapshot = buildPortfolioAppState({
      workbook: buildWorkbookSnapshot({
        tables: [
          buildWorkbookTable({
            name: 'Tabla11',
            displayName: 'Tabla11',
            rows: [{ 'Fondos com. Inv.': 'IOLCAMA' }],
            columns: ['Fondos com. Inv.'],
            rowCount: 1
          })
        ]
      }),
      dataset: {
        operations: [
          {
            id: 'op-182',
            date: '2026-06-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 26924.72,
            buyPrice: 10,
            total: 295245.403019649,
            currentPrice: 0,
            currentValue: 0,
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
            positionType: 'Valorizado',
            assetType: 'FCI',
            quantity: 26924.72,
            totalInvested: 295245.403019649,
            currentValue: 0
          })
        ],
        historicalPrices: [],
        dailyBalances: [{ date: '2026-06-09', month: 'jun-26', balance: 0 }],
        classifications: [buildClassification({ symbol: 'IOLCAMA', type: 'FCI' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const debug = service.debugMinimumBalanceTrendForDate(snapshot, '2026-06-09');

    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && lot.skipReason === 'missing-fci-historical-price')).toBeTrue();
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && !lot.skipped)).toBeFalse();
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

  it('consolidates FCI symbols from Tabla11 and does not duplicate sales in the historical series', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 806791.91,
      minimumExpectedArs: 1000,
      balanceVsMinimumArs: 805791.91,
      balanceVsMinimumPercentArs: 80579.191,
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
            date: '2026-06-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 80,
            total: 800,
            currentPrice: 806791.91,
            currentValue: 806791.91,
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
            date: '2026-06-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 80,
            total: 800,
            currentPrice: 806791.91,
            currentValue: 806791.91,
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
        sales: [
          {
            id: '67',
            buyDate: '2026-06-01',
            sellDate: '2026-07-31',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 80,
            total: 800,
            sellPrice: 82,
            totalSold: 820,
            amount: 0,
            price: 82,
            currentPrice: 82
          },
          {
            id: '69',
            buyDate: '2026-06-01',
            sellDate: '2026-07-31',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 80,
            total: 800,
            sellPrice: 82,
            totalSold: 820,
            amount: 0,
            price: 82,
            currentPrice: 82
          }
        ],
        investmentMovements: [],
        positions: [
          buildPortfolioPosition({
            symbol: 'IOLCAMA',
            currency: 'ARS',
            positionType: 'Accion',
            assetType: 'Accion',
            quantity: 20,
            totalInvested: 1600,
            currentValue: 806791.91
          })
        ],
        historicalPrices: [
          { date: '2026-06-30', month: 'jun-26', symbol: 'IOLCAMA', price: 806791.91 }
        ],
        dailyBalances: [],
        classifications: [
          buildClassification({ symbol: 'IOLCAMA', type: 'Accion' })
        ],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 30)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null
    });

    const trend = service.buildTrend(snapshot);
    const debug = service.debugMinimumBalanceTrendForDate(snapshot, '2026-06-30');

    expect(trend.points.length).toBe(1);
    expect(trend.points[0].comparableValueARS).toBeCloseTo(806791.91, 2);
    expect(debug.lots.filter((lot) => lot.symbol === 'IOLCAMA' && !lot.skipped).length).toBe(1);
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && lot.skipReason === 'fci-sale-ignored-when-fci-active')).toBeTrue();
  });

  it('omits an FCI that appears only in Tabla13', () => {
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
            rows: [{ 'Fondos com. Inv.': 'IOLCAMA' }],
            columns: ['Fondos com. Inv.'],
            rowCount: 1
          })
        ]
      }),
      dataset: {
        operations: [],
        sales: [
          {
            id: '67',
            buyDate: '2026-06-01',
            sellDate: '2026-06-30',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 80,
            total: 800,
            sellPrice: 82,
            totalSold: 820,
            amount: 0,
            price: 82,
            currentPrice: 82
          }
        ],
        investmentMovements: [],
        positions: [],
        historicalPrices: [
          { date: '2026-06-30', month: 'jun-26', symbol: 'IOLCAMA', price: 806791.91 }
        ],
        dailyBalances: [],
        classifications: [buildClassification({ symbol: 'IOLCAMA', type: 'Accion' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 30)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null
    });

    const debug = service.debugMinimumBalanceTrendForDate(snapshot, '2026-06-30');

    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && lot.skipReason === 'fci-sale-without-active-position')).toBeTrue();
    expect(debug.lots.some((lot) => lot.symbol === 'IOLCAMA' && !lot.skipped)).toBeFalse();
  });

  it('includes caucions before sellDate and excludes them on sellDate', () => {
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
            date: '2026-06-03',
            symbol: 'CAUCION COLOCADORA',
            currency: 'ARS',
            quantity: 200000,
            buyPrice: 1,
            total: 200000,
            currentPrice: 1,
            currentValue: 200000,
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
        sales: [
          {
            id: 's1',
            buyDate: '2026-06-03',
            sellDate: '2026-06-05',
            symbol: 'CAUCION COLOCADORA',
            currency: 'ARS',
            quantity: 200000,
            buyPrice: 1,
            total: 200000,
            sellPrice: 1,
            totalSold: 200000,
            amount: 0,
            price: 1,
            currentPrice: 1
          }
        ],
        investmentMovements: [],
        positions: [
          buildPortfolioPosition({
            symbol: 'CAUCION COLOCADORA',
            currency: 'ARS',
            positionType: 'Caucion',
            assetType: 'Caucion',
            quantity: 200000,
            totalInvested: 200000,
            currentValue: 200000
          })
        ],
        historicalPrices: [
          { date: '2026-06-04', month: 'jun-26', symbol: 'CAUCION COLOCADORA', price: 1 },
          { date: '2026-06-05', month: 'jun-26', symbol: 'CAUCION COLOCADORA', price: 1 }
        ],
        dailyBalances: [],
        classifications: [buildClassification({ symbol: 'CAUCION COLOCADORA', type: 'Caucion' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 3)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 4)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 5)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null
    });

    const debugBeforeClose = service.debugMinimumBalanceTrendForDate(snapshot, '2026-06-04');
    const debugOnClose = service.debugMinimumBalanceTrendForDate(snapshot, '2026-06-05');

    expect(debugBeforeClose.lots.some((lot) => lot.symbol === 'CAUCION COLOCADORA' && !lot.skipped)).toBeTrue();
    expect(debugOnClose.lots.some((lot) => lot.symbol === 'CAUCION COLOCADORA' && lot.skipReason === 'lot-not-active-at-date')).toBeTrue();
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

  it('builds a symbol historical series with comparable and minimum metadata', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 1200,
      minimumExpectedArs: 1100,
      balanceVsMinimumArs: 100,
      balanceVsMinimumPercentArs: 9.0909090909,
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
        historicalPrices: [{ date: '2025-01-31', month: 'ene-25', symbol: 'AAA', price: 120 }],
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
          { date: new Date(Date.UTC(2025, 0, 31)), tna: 10, dailyReturnPercent: 0.01, index: 110, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const report = service.buildTrendBySymbol(snapshot, 'AAA');

    expect(report.symbol).toBe('AAA');
    expect(report.currency).toBe('ARS');
    expect(report.points.length).toBe(1);
    expect(report.points[0].value).toBe(100);
    expect(report.points[0].meta?.marketValue).toBe(1200);
    expect(report.points[0].meta?.minimumExpectedARS).toBe(1100);
    expect(report.points[0].meta?.balanceVsMinimumARS).toBe(100);
    expect(report.points[0].meta?.included).toBeTrue();
    expect(report.emptyMessage).toBeNull();
  });

  it('builds a symbol series for FCI using Tabla5 value directly and consolidates duplicated sales', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 806791.91,
      minimumExpectedArs: 800000,
      balanceVsMinimumArs: 6791.91,
      balanceVsMinimumPercentArs: 0.84898875,
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
            rows: [{ 'Fondos com. Inv.': 'IOLCAMA' }],
            columns: ['Fondos com. Inv.'],
            rowCount: 1
          })
        ]
      }),
      dataset: {
        operations: [
          {
            id: 'op-182',
            date: '2026-06-01',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 26924.72,
            buyPrice: 10,
            total: 295245.403019649,
            currentPrice: 806791.91,
            currentValue: 806791.91,
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
        sales: [
          {
            id: 'sale-67',
            buyDate: '2026-06-01',
            sellDate: '2026-06-15',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 80,
            total: 800,
            sellPrice: 82,
            totalSold: 820,
            amount: 0,
            price: 82,
            currentPrice: 82
          },
          {
            id: 'sale-69',
            buyDate: '2026-06-01',
            sellDate: '2026-06-15',
            symbol: 'IOLCAMA',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 80,
            total: 800,
            sellPrice: 82,
            totalSold: 820,
            amount: 0,
            price: 82,
            currentPrice: 82
          }
        ],
        investmentMovements: [],
        positions: [
          buildPortfolioPosition({
            symbol: 'IOLCAMA',
            currency: 'ARS',
            positionType: 'Valorizado',
            assetType: 'FCI',
            quantity: 26924.72,
            totalInvested: 295245.403019649,
            currentValue: 806791.91
          })
        ],
        historicalPrices: [{ date: '2026-06-09', month: 'jun-26', symbol: 'IOLCAMA', price: 806791.91 }],
        dailyBalances: [{ date: '2026-06-09', month: 'jun-26', balance: 0 }],
        classifications: [buildClassification({ symbol: 'IOLCAMA', type: 'FCI' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 9)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const report = service.buildTrendBySymbol(snapshot, 'IOLCAMA', 'daily');
    const debug = service.debugMinimumBalanceTrendForSymbolAtDate(snapshot, 'IOLCAMA', '2026-06-09');

    expect(report.points.length).toBe(1);
    expect(report.points[0].meta?.marketValue).toBeCloseTo(806791.91, 2);
    expect(report.points[0].meta?.included).toBeTrue();
    expect(debug.included).toBeTrue();
    expect(debug.marketValue).toBeCloseTo(806791.91, 2);
    expect(debug.skipReason).toBeNull();
  });

  it('builds a symbol series for caucions only while active and omits them on sellDate', () => {
    minimumPerformance.buildMinimumPerformanceSummary.and.returnValue({
      currency: 'ARS',
      comparableLotsCount: 1,
      currentComparableArs: 200000,
      minimumExpectedArs: 180000,
      balanceVsMinimumArs: 20000,
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
            date: '2026-06-03',
            symbol: 'CAUCION COLOCADORA',
            currency: 'ARS',
            quantity: 200000,
            buyPrice: 1,
            total: 200000,
            currentPrice: 1,
            currentValue: 200000,
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
        sales: [
          {
            id: 's1',
            buyDate: '2026-06-03',
            sellDate: '2026-06-05',
            symbol: 'CAUCION COLOCADORA',
            currency: 'ARS',
            quantity: 200000,
            buyPrice: 1,
            total: 200000,
            sellPrice: 1,
            totalSold: 200000,
            amount: 0,
            price: 1,
            currentPrice: 1
          }
        ],
        investmentMovements: [],
        positions: [
          buildPortfolioPosition({
            symbol: 'CAUCION COLOCADORA',
            currency: 'ARS',
            positionType: 'Caucion',
            assetType: 'Caucion',
            quantity: 200000,
            totalInvested: 200000,
            currentValue: 200000
          })
        ],
        historicalPrices: [
          { date: '2026-06-04', month: 'jun-26', symbol: 'CAUCION COLOCADORA', price: 1 },
          { date: '2026-06-05', month: 'jun-26', symbol: 'CAUCION COLOCADORA', price: 1 }
        ],
        dailyBalances: [
          { date: '2026-06-04', month: 'jun-26', balance: 0 },
          { date: '2026-06-05', month: 'jun-26', balance: 0 }
        ],
        classifications: [buildClassification({ symbol: 'CAUCION COLOCADORA', type: 'Caucion' })],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [buildMonthlySummary({ month: 'jun-26', year: 2026 })],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 3)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 4)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 5)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' }
        ]
      },
      summary: null,
      workbook: null
    });

    const report = service.buildTrendBySymbol(snapshot, 'CAUCION COLOCADORA', 'daily');
    const activeDebug = service.debugMinimumBalanceTrendForSymbolAtDate(snapshot, 'CAUCION COLOCADORA', '2026-06-04');
    const closedDebug = service.debugMinimumBalanceTrendForSymbolAtDate(snapshot, 'CAUCION COLOCADORA', '2026-06-05');

    expect(report.points.length).toBe(1);
    expect(report.points[0].meta?.marketValue).toBe(200000);
    expect(activeDebug.included).toBeTrue();
    expect(activeDebug.marketValue).toBe(200000);
    expect(closedDebug.included).toBeFalse();
    expect(closedDebug.skipReason).not.toBeNull();
  });
});
