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
    expect(strategy?.breakdown?.[0].currentPercent).toBeCloseTo(56.4, 1);
    expect(strategy?.breakdown?.[0].targetPercent).toBeCloseTo(43.6, 1);
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
});
