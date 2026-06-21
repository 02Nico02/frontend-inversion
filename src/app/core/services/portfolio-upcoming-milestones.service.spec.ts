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

    expect(goals[1].id).toBe('recover-monthly-max');
    expect(goals[1].targetValue).toBe(9116850.18);
    expect(goals[1].remainingAmount).toBeCloseTo(337045.15, 2);
    expect(goals[1].estimatedMonths).toBe(1);

    expect(strategy?.breakdown?.length).toBe(2);
    expect(strategy?.breakdown?.[0].currency).toBe('ARS');
    expect(strategy?.breakdown?.[0].retirementPercent).toBeCloseTo(56.4, 1);
    expect(strategy?.breakdown?.[0].savingsPercent).toBeCloseTo(43.6, 1);
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

  it('marks historical recovery as reached when the current value beats the monthly maximum', () => {
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

    expect(historicalRecovery?.status).toBe('reached');
    expect(historicalRecovery?.remainingAmount).toBe(0);
    expect(historicalRecovery?.remainingPercent).toBe(0);
    expect(historicalRecovery?.estimatedMonths).toBeNull();
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
