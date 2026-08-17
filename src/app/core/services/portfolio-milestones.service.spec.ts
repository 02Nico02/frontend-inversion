import { TestBed } from '@angular/core/testing';

import { PortfolioMilestonesService } from './portfolio-milestones.service';
import { buildMonthlySummary, buildDailyBalance, buildPortfolioAppState, buildPortfolioSummary } from '../testing/portfolio-test-builders';

describe('PortfolioMilestonesService', () => {
  let service: PortfolioMilestonesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortfolioMilestonesService]
    });
    service = TestBed.inject(PortfolioMilestonesService);
  });

  it('detects monthly thresholds, monthly returns and daily extremes', () => {
    const snapshot = buildPortfolioAppState({
      dataset: {
        operations: [],
        sales: [],
        investmentMovements: [],
        positions: [],
        historicalPrices: [],
        dailyBalances: [
          buildDailyBalance({ date: '2026-06-05', balance: -237430.99 }),
          buildDailyBalance({ date: '2026-06-08', balance: 55567.82 }),
          buildDailyBalance({ date: '2026-03-31', balance: 139297.42 }),
          buildDailyBalance({ date: '2026-06-06', balance: -262602.7 })
        ],
        classifications: [],
        manualAlerts: [],
        calculatedAlerts: [],
        signals: [],
        monthlySummary: [
          buildMonthlySummary({ month: 'jul-25', year: 2025, endValue: 900000, variationPercent: 12.49, realReturnPercent: 10.39, purchases: 200, result: 100 }),
          buildMonthlySummary({ month: 'ene-26', year: 2026, endValue: 1100000, variationPercent: 5.99, realReturnPercent: 3.01, purchases: 300, result: 150 }),
          buildMonthlySummary({ month: 'mar-26', year: 2026, endValue: 5200000, variationPercent: 0.01, realReturnPercent: -3.28, purchases: 500, result: 250 }),
          buildMonthlySummary({ month: 'abr-26', year: 2026, endValue: 4300000, variationPercent: -8.79, realReturnPercent: -11.28, purchases: 100, result: 90 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      summary: null,
      workbook: null
    });

    const report = service.buildMilestoneReport(snapshot);
    const detectedTitles = report.detected.map((item) => item.title);
    const highlighted = service.getHighlightedMilestones(report.detected);

    expect(detectedTitles).toContain('Primer mes arriba de 1.000.000');
    expect(detectedTitles).toContain('Primer mes arriba de 5.000.000');
    expect(detectedTitles).toContain('Mayor ganancia diaria');
    expect(detectedTitles).toContain('Mayor pérdida diaria');
    expect(detectedTitles).toContain('Mejor mes nominal');
    expect(detectedTitles).toContain('Peor mes nominal');
    expect(detectedTitles).toContain('Mejor mes real');
    expect(detectedTitles).toContain('Peor mes real');
    expect(detectedTitles).toContain('Primer mes positivo real');
    expect(detectedTitles).toContain('Mes con mayor aporte');
    expect(detectedTitles).toContain('Mes con mayor resultado por rendimiento');
    expect(report.unavailable.some((item) => item.title.includes('10.000.000'))).toBeTrue();
    expect(report.unavailable.map((item) => item.id)).toContain('first-month-above-minimum-benchmark');
    expect(highlighted.map((item) => item.id)).toEqual([
      'max-monthly-value',
      'value-threshold-1000000',
      'value-threshold-5000000',
      'largest-daily-increase',
      'largest-daily-drop',
      'largest-monthly-result'
    ]);
  });

  it('detects when monthly income already covers monthly contributions', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 50000000, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
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
          buildMonthlySummary({ month: 'jul-25', year: 2025, endValue: 40000000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'ago-25', year: 2025, endValue: 40400000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'sep-25', year: 2025, endValue: 40804000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'oct-25', year: 2025, endValue: 41212040, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'nov-25', year: 2025, endValue: 41624160.4, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'dic-25', year: 2025, endValue: 42040377.0, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'ene-26', year: 2026, endValue: 42460780.77, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'feb-26', year: 2026, endValue: 42885388.58, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'mar-26', year: 2026, endValue: 43314242.47, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'abr-26', year: 2026, endValue: 43747384.9, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'may-26', year: 2026, endValue: 44184858.75, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'jun-26', year: 2026, endValue: 44626747.34, variationPercent: 1, realReturnPercent: 1 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const report = service.buildMilestoneReportWithContribution(snapshot, 370000);
    const incomeCoverage = report.detected.find((item) => item.id === 'monthly-income-covers-contribution');

    expect(incomeCoverage?.category).toBe('income-coverage');
    expect(incomeCoverage?.severity).toBe('positive');
    expect(incomeCoverage?.value).toBeGreaterThan(370000);
    expect(service.getHighlightedMilestones(report.detected).map((item) => item.id)).toContain('monthly-income-covers-contribution');
  });

  it('adds higher value thresholds as pending milestones when the portfolio has not reached them yet', () => {
    const snapshot = buildPortfolioAppState({
      summary: buildPortfolioSummary({
        byCurrency: [
          { currency: 'ARS', totalCurrentValue: 10131397.08, totalInvested: 0, totalResult: 0, totalResultPercent: 0, speciesCount: 0 }
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
          buildMonthlySummary({ month: 'may-25', year: 2025, endValue: 9000000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'jun-25', year: 2025, endValue: 9600000, variationPercent: 1, realReturnPercent: 1 }),
          buildMonthlySummary({ month: 'jul-25', year: 2025, endValue: 10300000, variationPercent: 1, realReturnPercent: 1 })
        ],
        annualSummary: [],
        monthlyPerformance: [],
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      workbook: null
    });

    const report = service.buildMilestoneReport(snapshot);
    const pendingIds = report.unavailable.map((item) => item.id);

    expect(pendingIds).toContain('first-month-above-15000000');
    expect(pendingIds).toContain('first-month-above-20000000');
    expect(pendingIds).toContain('first-month-above-30000000');
  });

  it('returns the most recent milestone by date', () => {
    const latest = service.getLatestMilestone([
      {
        id: 'old',
        title: 'Old',
        description: '',
        category: 'portfolio-value',
        severity: 'positive',
        date: '2024-01-01',
        value: 1,
        percent: null,
        currency: 'ARS',
        source: 'X'
      },
      {
        id: 'new',
        title: 'New',
        description: '',
        category: 'portfolio-value',
        severity: 'positive',
        date: '2026-06-01',
        value: 1,
        percent: null,
        currency: 'ARS',
        source: 'X'
      },
      {
        id: 'mid',
        title: 'Mid',
        description: '',
        category: 'portfolio-value',
        severity: 'positive',
        date: '2025-01-01',
        value: 1,
        percent: null,
        currency: 'ARS',
        source: 'X'
      }
    ]);

    expect(latest?.id).toBe('new');
  });
});
