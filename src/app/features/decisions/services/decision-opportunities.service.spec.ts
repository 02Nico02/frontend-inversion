import { TestBed } from '@angular/core/testing';

import { buildPortfolioAppState, buildPortfolioPosition } from '../../../core/testing/portfolio-test-builders';
import { CurrencyMapperService } from '../../../core/services/currency-mapper.service';
import { MinimumPerformanceService } from '../../../core/services/minimum-performance.service';
import { EffectivePortfolioPosition, PositionEffectiveMetricsService } from '../../../core/services/position-effective-metrics.service';
import { DecisionOpportunitiesService } from './decision-opportunities.service';

describe('DecisionOpportunitiesService', () => {
  let service: DecisionOpportunitiesService;
  let minimumPerformanceSpy: jasmine.SpyObj<MinimumPerformanceService>;
  let effectiveMetricsSpy: jasmine.SpyObj<PositionEffectiveMetricsService>;

  beforeEach(() => {
    minimumPerformanceSpy = jasmine.createSpyObj<MinimumPerformanceService>('MinimumPerformanceService', [
      'buildMinimumPerformanceBySymbol',
      'buildMinimumPerformanceSummary'
    ]);
    effectiveMetricsSpy = jasmine.createSpyObj<PositionEffectiveMetricsService>('PositionEffectiveMetricsService', [
      'buildEffectivePositions'
    ]);

    TestBed.configureTestingModule({
      providers: [
        DecisionOpportunitiesService,
        CurrencyMapperService,
        { provide: MinimumPerformanceService, useValue: minimumPerformanceSpy },
        { provide: PositionEffectiveMetricsService, useValue: effectiveMetricsSpy }
      ]
    });

    service = TestBed.inject(DecisionOpportunitiesService);
  });

  it('includes only ARS positions that are nominally positive but below minimum expected', () => {
    const snapshot = buildPortfolioAppState();
    minimumPerformanceSpy.buildMinimumPerformanceBySymbol.and.returnValue([]);
    minimumPerformanceSpy.buildMinimumPerformanceSummary.and.returnValue({
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
    effectiveMetricsSpy.buildEffectivePositions.and.returnValue([
      buildEffectivePosition({
        symbol: 'AAA',
        currency: 'ARS',
        nominalResultAmount: 1000,
        nominalResultPercent: 3.5,
        minimumExpectedValue: 5000,
        minimumValueVsAmount: -2000,
        minimumValueVsPercent: -6.2,
        positionType: 'Accion',
        assetType: 'Accion'
      }),
      buildEffectivePosition({
        symbol: 'BBB',
        currency: 'ARS',
        nominalResultAmount: 1000,
        nominalResultPercent: 3.5,
        minimumExpectedValue: 5000,
        minimumValueVsAmount: 500,
        minimumValueVsPercent: 10,
        positionType: 'Accion',
        assetType: 'Accion'
      }),
      buildEffectivePosition({
        symbol: 'CCC',
        currency: 'ARS',
        nominalResultAmount: -1000,
        nominalResultPercent: -4,
        minimumExpectedValue: 5000,
        minimumValueVsAmount: -2000,
        minimumValueVsPercent: -6.2,
        positionType: 'Accion',
        assetType: 'Accion'
      }),
      buildEffectivePosition({
        symbol: 'IOLCAMA',
        currency: 'ARS',
        nominalResultAmount: 1000,
        nominalResultPercent: 3.5,
        minimumExpectedValue: 5000,
        minimumValueVsAmount: -2000,
        minimumValueVsPercent: -6.2,
        positionType: 'Valorizado',
        assetType: 'FCI'
      }),
      buildEffectivePosition({
        symbol: 'USD1',
        currency: 'USD',
        nominalResultAmount: 1000,
        nominalResultPercent: 3.5,
        minimumExpectedValue: null,
        minimumValueVsAmount: null,
        minimumValueVsPercent: null,
        positionType: 'Accion',
        assetType: 'Accion'
      })
    ]);

    const vm = service.build(snapshot);

    expect(vm.misleadingPositions.total).toBe(1);
    expect(vm.misleadingPositions.items.map((item) => item.symbol)).toEqual(['AAA']);
    expect(vm.misleadingPositions.items[0].note).toContain('Resultado nominal');
  });

  it('limits the misleading positions list to five and orders the worst first', () => {
    const snapshot = buildPortfolioAppState();
    minimumPerformanceSpy.buildMinimumPerformanceBySymbol.and.returnValue([]);
    minimumPerformanceSpy.buildMinimumPerformanceSummary.and.returnValue({
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

    effectiveMetricsSpy.buildEffectivePositions.and.returnValue(
      Array.from({ length: 10 }, (_, index) =>
        buildEffectivePosition({
          symbol: `P${index + 1}`,
          currency: 'ARS',
          nominalResultAmount: 1000 + index,
          nominalResultPercent: 2 + index,
          minimumExpectedValue: 5000,
          minimumValueVsAmount: -1000 - index * 100,
          minimumValueVsPercent: -1 - index,
          positionType: 'Accion',
          assetType: 'Accion'
        })
      )
    );

    const vm = service.build(snapshot);

    expect(vm.misleadingPositions.total).toBe(5);
    expect(vm.misleadingPositions.items[0].symbol).toBe('P10');
    expect(vm.misleadingPositions.items[4].symbol).toBe('P6');
  });

  it('returns an empty state with a short explanation when no misleading positions are found', () => {
    const snapshot = buildPortfolioAppState();
    minimumPerformanceSpy.buildMinimumPerformanceBySymbol.and.returnValue([]);
    minimumPerformanceSpy.buildMinimumPerformanceSummary.and.returnValue({
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
    effectiveMetricsSpy.buildEffectivePositions.and.returnValue([]);

    const vm = service.build(snapshot);

    expect(vm.misleadingPositions.total).toBe(0);
    expect(vm.misleadingPositions.items).toEqual([]);
    expect(vm.misleadingPositions.note).toContain('no implica vender');
  });
});

function buildEffectivePosition(args: {
  symbol: string;
  currency: 'ARS' | 'USD';
  nominalResultAmount: number | null;
  nominalResultPercent: number | null;
  minimumExpectedValue: number | null;
  minimumValueVsAmount: number | null;
  minimumValueVsPercent: number | null;
  positionType: string;
  assetType: string;
}) {
  const position = buildPortfolioPosition({
    symbol: args.symbol,
    currency: args.currency,
    positionType: args.positionType,
    assetType: args.assetType,
    quantity: 10,
    totalInvested: 1000,
    currentValue: 1200
  });

  return {
    symbol: args.symbol,
    currency: args.currency,
    position,
    nominalResultAmount: args.nominalResultAmount,
    nominalResultPercent: args.nominalResultPercent,
    effectiveResultAmount: args.nominalResultAmount,
    effectiveResultPercent: args.nominalResultPercent,
    resultWasAdjustedByMovements: false,
    movementSummary: null,
    minimumPerformance: {
      symbol: args.symbol,
      currency: args.currency,
      lotsCount: 1,
      investedAmount: 1000,
      currentValue: 1200,
      marketCurrentValue: 1200,
      comparableValue: 1200,
      usesAdjustedComparableValue: false,
      incomeAmount: 0,
      capitalReturnedAmount: 0,
      minimumExpectedValueRaw: args.minimumExpectedValue,
      minimumExpectedValueAdjusted: args.minimumExpectedValue,
      usesAmortizationAdjustedBenchmark: false,
      benchmarkAccruedAmount: null,
      remainingExposedCapital: null,
      minimumExpectedValue: args.minimumExpectedValue,
      valueVsMinimumAmount: args.minimumValueVsAmount,
      valueVsMinimumPercent: args.minimumValueVsPercent,
      status: args.minimumValueVsAmount !== null && args.minimumValueVsAmount < 0 ? 'below-minimum' : 'beats-minimum',
      lots: [],
      notes: []
    },
    minimumExpectedValue: args.minimumExpectedValue,
    minimumValueVsAmount: args.minimumValueVsAmount,
    minimumValueVsPercent: args.minimumValueVsPercent,
    minimumWasAdjustedByMovements: false,
    notes: []
  } as EffectivePortfolioPosition;
}
