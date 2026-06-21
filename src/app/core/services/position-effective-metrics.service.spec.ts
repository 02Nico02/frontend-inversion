import { TestBed } from '@angular/core/testing';

import { PositionEffectiveMetricsService } from './position-effective-metrics.service';
import { PortfolioCalculatorService } from './portfolio-calculator.service';
import { InvestmentMovementsPerformanceService } from './investment-movements-performance.service';
import { MinimumPerformanceService } from './minimum-performance.service';
import { CurrencyMapperService } from './currency-mapper.service';
import { PrivacyModeService } from './privacy-mode.service';
import { buildPortfolioAppState, buildPortfolioPosition } from '../testing/portfolio-test-builders';
import { PortfolioPosition } from '../models/portfolio.models';
import { InvestmentMovementSummary } from '../models/investment-movements.model';
import { MinimumPerformanceBySymbol } from '../models/minimum-performance.model';

describe('PositionEffectiveMetricsService', () => {
  const privacyMode = { enabled: false };
  let service: PositionEffectiveMetricsService;
  let calculatorSpy: jasmine.SpyObj<PortfolioCalculatorService>;
  let movementsSpy: jasmine.SpyObj<InvestmentMovementsPerformanceService>;
  let minimumSpy: jasmine.SpyObj<MinimumPerformanceService>;

  beforeEach(() => {
    calculatorSpy = jasmine.createSpyObj<PortfolioCalculatorService>('PortfolioCalculatorService', ['enrichPositions']);
    movementsSpy = jasmine.createSpyObj<InvestmentMovementsPerformanceService>('InvestmentMovementsPerformanceService', ['buildSummaryBySymbol']);
    minimumSpy = jasmine.createSpyObj<MinimumPerformanceService>('MinimumPerformanceService', ['buildMinimumPerformanceBySymbol']);

    TestBed.configureTestingModule({
      providers: [
        PositionEffectiveMetricsService,
        CurrencyMapperService,
        {
          provide: PrivacyModeService,
          useValue: privacyMode
        },
        {
          provide: PortfolioCalculatorService,
          useValue: calculatorSpy
        },
        {
          provide: InvestmentMovementsPerformanceService,
          useValue: movementsSpy
        },
        {
          provide: MinimumPerformanceService,
          useValue: minimumSpy
        }
      ]
    });
    service = TestBed.inject(PositionEffectiveMetricsService);
  });

  it('uses adjusted results when movements changed the position economics', () => {
    const position: PortfolioPosition = buildPortfolioPosition({
      symbol: 'TX26',
      currency: 'ARS',
      currentValue: 700,
      totalInvested: 1000,
      resultAmount: -300,
      resultPercent: -30
    });
    const movementSummary: InvestmentMovementSummary = {
      symbol: 'TX26',
      currency: 'ARS',
      incomeAmount: 100,
      capitalReturnedAmount: 200,
      totalMovementsAmount: 300,
      marketResultAmount: -300,
      marketResultPercent: -30,
      adjustedResultAmount: 0,
      adjustedResultPercent: 0,
      hasAdjustments: true,
      movementsCount: 2,
      notes: ['Movimiento ajustado']
    };
    const minimumSummary: MinimumPerformanceBySymbol = {
      symbol: 'TX26',
      currency: 'ARS',
      lotsCount: 1,
      investedAmount: 1000,
      currentValue: 700,
      marketCurrentValue: 700,
      comparableValue: 1000,
      usesAdjustedComparableValue: true,
      incomeAmount: 100,
      capitalReturnedAmount: 200,
      minimumExpectedValueRaw: 1100,
      minimumExpectedValueAdjusted: 1000,
      usesAmortizationAdjustedBenchmark: true,
      benchmarkAccruedAmount: 0,
      remainingExposedCapital: 800,
      minimumExpectedValue: 1000,
      valueVsMinimumAmount: 0,
      valueVsMinimumPercent: 0,
      status: 'beats-minimum',
      lots: [],
      notes: ['Benchmark ajustado']
    };

    calculatorSpy.enrichPositions.and.returnValue([position]);
    movementsSpy.buildSummaryBySymbol.and.returnValue([movementSummary]);
    minimumSpy.buildMinimumPerformanceBySymbol.and.returnValue([minimumSummary]);

    const result = service.buildEffectivePositions(buildPortfolioAppState({
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
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      summary: null,
      workbook: null
    }));

    expect(result.length).toBe(1);
    expect(result[0].position.currentValue).toBe(700);
    expect(result[0].nominalResultAmount).toBe(-300);
    expect(result[0].effectiveResultAmount).toBe(0);
    expect(result[0].effectiveResultPercent).toBe(0);
    expect(result[0].resultWasAdjustedByMovements).toBeTrue();
    expect(result[0].minimumWasAdjustedByMovements).toBeTrue();
    expect(result[0].notes).toContain('Resultado ajustado por movimientos de inversión.');
    expect(result[0].notes).toContain('Benchmark mínimo ajustado por movimientos/amortizaciones.');
  });

  it('keeps nominal metrics when no adjustments exist', () => {
    calculatorSpy.enrichPositions.and.returnValue([
      buildPortfolioPosition({
        symbol: 'AMD',
        currency: 'ARS',
        currentValue: 1200,
        totalInvested: 1000,
        resultAmount: 200,
        resultPercent: 20
      })
    ]);
    movementsSpy.buildSummaryBySymbol.and.returnValue([]);
    minimumSpy.buildMinimumPerformanceBySymbol.and.returnValue([]);

    const result = service.buildEffectivePositions(buildPortfolioAppState({
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
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      },
      summary: null,
      workbook: null
    }));

    expect(result[0].effectiveResultAmount).toBe(200);
    expect(result[0].effectiveResultPercent).toBe(20);
    expect(result[0].resultWasAdjustedByMovements).toBeFalse();
    expect(result[0].minimumWasAdjustedByMovements).toBeFalse();
  });
});
