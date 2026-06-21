import { TestBed } from '@angular/core/testing';

import { PortfolioConcentrationService } from './portfolio-concentration.service';
import { buildPortfolioPosition } from '../testing/portfolio-test-builders';

describe('PortfolioConcentrationService', () => {
  let service: PortfolioConcentrationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortfolioConcentrationService]
    });
    service = TestBed.inject(PortfolioConcentrationService);
  });

  it('calculates concentration and ranking by currency scope', () => {
    const positions = [
      buildPortfolioPosition({ symbol: 'A', currency: 'ARS', currentValue: 700, sector: 'S1', subsector: 'SS1', region: 'R1', assetType: 'Tipo1' }),
      buildPortfolioPosition({ symbol: 'B', currency: 'ARS', currentValue: 300, sector: 'S2', subsector: 'SS2', region: 'R1', assetType: 'Tipo2' }),
      buildPortfolioPosition({ symbol: 'C', currency: 'USD', currentValue: 100, sector: 'S3', subsector: 'SS3', region: 'R2', assetType: 'Tipo3' })
    ];

    const report = service.buildReport(positions, 'ARS');

    expect(report.currencyScope).toBe('ARS');
    expect(report.totalCurrentValue).toBe(1000);
    expect(report.top1Percent).toBeCloseTo(70, 2);
    expect(report.top3Percent).toBeCloseTo(100, 2);
    expect(report.top5Percent).toBeCloseTo(100, 2);
    expect(report.top10Percent).toBeCloseTo(100, 2);
    expect(report.ranking.length).toBe(2);
    expect(report.ranking[0].symbol).toBe('A');
    expect(report.ranking[0].weightPercent).toBeCloseTo(70, 2);
    expect(report.largestPosition?.symbol).toBe('A');
    expect(report.largestRegion?.categoryCount).toBe(1);
  });

  it('calculates top N concentration from the ranking without mixing currencies', () => {
    const positions = [
      buildPortfolioPosition({ symbol: 'AAPL', currency: 'ARS', currentValue: 500 }),
      buildPortfolioPosition({ symbol: 'MSFT', currency: 'ARS', currentValue: 300 }),
      buildPortfolioPosition({ symbol: 'GLD', currency: 'ARS', currentValue: 200 }),
      buildPortfolioPosition({ symbol: 'SPY', currency: 'USD', currentValue: 1000 })
    ];

    const report = service.buildReport(positions, 'ARS');

    expect(report.top1Percent).toBeCloseTo(50, 2);
    expect(report.ranking[1].cumulativeWeightPercent).toBeCloseTo(80, 2);
    expect(report.top5Percent).toBeCloseTo(100, 2);
    expect(report.top10Percent).toBeCloseTo(100, 2);
  });

  it('returns controlled values when the scoped total is zero', () => {
    const report = service.buildReport([
      buildPortfolioPosition({ symbol: 'A', currency: 'ARS', currentValue: 0 }),
      buildPortfolioPosition({ symbol: 'B', currency: 'ARS', currentValue: 0 })
    ], 'ARS');

    expect(report.totalCurrentValue).toBe(0);
    expect(report.top1Percent).toBe(0);
    expect(report.top3Percent).toBe(0);
    expect(report.top5Percent).toBe(0);
    expect(report.top10Percent).toBe(0);
    expect(Number.isNaN(report.top1Percent)).toBeFalse();
    expect(Number.isFinite(report.top1Percent)).toBeTrue();
  });

  it('returns zero concentration for empty inputs', () => {
    const report = service.buildReport([], 'ALL');

    expect(report.totalCurrentValue).toBe(0);
    expect(report.top1Percent).toBe(0);
    expect(report.top3Percent).toBe(0);
    expect(report.top5Percent).toBe(0);
    expect(report.top10Percent).toBe(0);
    expect(report.ranking.length).toBe(0);
    expect(report.largestPosition).toBeNull();
  });
});
