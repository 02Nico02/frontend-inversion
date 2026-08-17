import { TestBed } from '@angular/core/testing';

import { PortfolioUpcomingMilestonesService } from './portfolio-upcoming-milestones.service';
import { buildPortfolioAppState, buildStrategicSplit, buildMonthlySummary, buildPortfolioSummary } from '../testing/portfolio-test-builders';

describe('PortfolioUpcomingMilestonesService', () => {
  let service: PortfolioUpcomingMilestonesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortfolioUpcomingMilestonesService]
    });
    service = TestBed.inject(PortfolioUpcomingMilestonesService);
  });

  it('builds the next million, historical recovery and strategy guidance goals', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 8779805.03, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 },
          { currency: 'USD', totalCurrentValue: 0, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'jun-26', year: 2026, endValue: 9116850.18 }),
          buildMonthlySummary({ month: 'may-26', year: 2026, endValue: 8457201.51 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [
          buildStrategicSplit({
            date: '2026-06-15',
            retirementAmountARS: 4533231.77,
            savingsAmountARS: 3504658.95,
            retirementAmountUSD: 226.46,
            savingsAmountUSD: 198.14
          })
        ],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const goals = service.buildUpcomingMilestones(snapshot, 370000);
    const strategy = goals.find((goal) => goal.id === 'strategy-balance-guidance');

    expect(goals[0].id).toBe('next-million-ars');
    expect(goals[0].targetValue).toBe(9000000);
    expect(goals[0].remainingAmount).toBeCloseTo(220194.97, 2);
    expect(goals[0].estimatedMonths).toBe(1);

    expect(strategy?.breakdown?.length).toBe(2);
    expect(strategy?.breakdown?.[0].currency).toBe('ARS');
    expect(strategy?.breakdown?.[0].retirementPercent).toBeCloseTo(56.4, 1);
    expect(strategy?.breakdown?.[0].savingsPercent).toBeCloseTo(43.6, 1);
    expect(goals.find((goal) => goal.id === 'recover-monthly-max')).toBeUndefined();
  });

  it('skips duplicated manual goals when they match the next million target', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 9000000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'jun-26', year: 2026, endValue: 9500000 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [
          buildStrategicSplit({
            date: '2026-06-15',
            retirementAmountARS: 100,
            savingsAmountARS: 100,
            retirementAmountUSD: 10,
            savingsAmountUSD: 10
          })
        ],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const goals = service.buildUpcomingMilestones(snapshot, null);

    expect(goals.map((goal) => goal.id)).not.toContain('manual-goal-10000000');
    expect(goals.length).toBe(3);
  });

  it('adds a coverage goal for monthly returns versus monthly contributions when it is not yet reached', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 30000000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'jul-25', year: 2025, endValue: 20000000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'ago-25', year: 2025, endValue: 20200000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'sep-25', year: 2025, endValue: 20402000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'oct-25', year: 2025, endValue: 20606020, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'nov-25', year: 2025, endValue: 20812080.2, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'dic-25', year: 2025, endValue: 21020201.0, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'ene-26', year: 2026, endValue: 21230403.01, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'feb-26', year: 2026, endValue: 21442707.04, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'mar-26', year: 2026, endValue: 21657134.11, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'abr-26', year: 2026, endValue: 21873705.45, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'may-26', year: 2026, endValue: 22092442.5, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'jun-26', year: 2026, endValue: 22313366.93, variationPercent: 1, realReturnPercent: 1 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const goal = service.buildUpcomingMilestones(snapshot, 370000).find((item) => item.id === 'monthly-income-covers-contribution');

    expect(goal?.category).toBe('income-coverage');
    expect(goal?.status).toBe('pending');
    expect(goal?.targetValue).toBe(370000);
    expect(goal?.estimatedMonths).not.toBeNull();
  });

  it('moves to the next million when the current value is already an exact multiple', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 9000000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'jun-26', year: 2026, endValue: 9000000 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const goals = service.buildUpcomingMilestones(snapshot, null);

    expect(goals[0].targetValue).toBe(10000000);
    expect(goals[0].remainingAmount).toBe(1000000);
    expect(goals.find((goal) => goal.id === 'manual-goal-10000000')).toBeUndefined();
  });

  it('does not include historical recovery in upcoming milestones when it is already reached', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 9200000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'jun-26', year: 2026, endValue: 9116850.18 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const historicalRecovery = service.buildUpcomingMilestones(snapshot, 0).find((goal) => goal.id === 'recover-monthly-max');

    expect(historicalRecovery).toBeUndefined();
  });

  it('uses the strategy split references without hardcoding a 50/50 split', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 1000000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 },
          { currency: 'USD', totalCurrentValue: 100000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
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
        strategicSplit: [
          buildStrategicSplit({
            date: '2026-06-15',
            retirementAmountARS: 1000,
            savingsAmountARS: 500,
            retirementAmountUSD: 100,
            savingsAmountUSD: 100
          })
        ],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const strategy = service.buildUpcomingMilestones(snapshot, null).find((goal) => goal.id === 'strategy-balance-guidance');

    expect(strategy?.breakdown?.length).toBe(2);
    expect(strategy?.breakdown?.find((item) => item.currency === 'ARS')?.retirementPercent).toBeCloseTo(66.67, 2);
    expect(strategy?.breakdown?.find((item) => item.currency === 'ARS')?.savingsPercent).toBeCloseTo(33.33, 2);
    expect(strategy?.breakdown?.find((item) => item.currency === 'USD')?.retirementPercent).toBeCloseTo(50, 2);
    expect(strategy?.breakdown?.find((item) => item.currency === 'USD')?.savingsPercent).toBeCloseTo(50, 2);
  });

  it('does not estimate months when the monthly contribution is zero or missing', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 8779805.03, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'jun-26', year: 2026, endValue: 9116850.18 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const goals = service.buildUpcomingMilestones(snapshot, 0);

    expect(goals[0].estimatedMonths).toBeNull();
    expect(goals[1].estimatedMonths).toBeNull();
  });

  it('recomputes the strategic reference when Tabla35 includes a negative savings outflow', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 1500000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 },
          { currency: 'USD', totalCurrentValue: 200, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
        ]
      }),
      dataset: {
        operations: [],
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
        strategicSplit: [
          buildStrategicSplit({
            date: '2026-06-01',
            retirementAmountARS: 1000000,
            savingsAmountARS: 1000000,
            retirementAmountUSD: 100,
            savingsAmountUSD: 100
          }),
          buildStrategicSplit({
            date: '2026-06-15',
            retirementAmountARS: 0,
            savingsAmountARS: -500000,
            retirementAmountUSD: 0,
            savingsAmountUSD: 0
          })
        ],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const strategy = service.buildUpcomingMilestones(snapshot, null).find((goal) => goal.id === 'strategy-balance-guidance');
    const arsBreakdown = strategy?.breakdown?.find((item) => item.currency === 'ARS');
    const usdBreakdown = strategy?.breakdown?.find((item) => item.currency === 'USD');

    expect(arsBreakdown?.retirementAmount).toBe(1000000);
    expect(arsBreakdown?.savingsAmount).toBe(500000);
    expect(arsBreakdown?.retirementPercent).toBeCloseTo(66.67, 2);
    expect(arsBreakdown?.savingsPercent).toBeCloseTo(33.33, 2);
    expect(arsBreakdown?.gapPercent).toBeCloseTo(33.33, 2);
    expect(usdBreakdown?.retirementPercent).toBeCloseTo(50, 2);
    expect(usdBreakdown?.savingsPercent).toBeCloseTo(50, 2);
  });
});
