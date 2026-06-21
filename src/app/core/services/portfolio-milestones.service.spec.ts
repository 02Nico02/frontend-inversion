import { TestBed } from '@angular/core/testing';

import { PortfolioMilestonesService } from './portfolio-milestones.service';
import { buildMonthlySummary, buildDailyBalance, buildPortfolioAppState } from '../testing/portfolio-test-builders';

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
