import { TestBed } from '@angular/core/testing';

import { buildPortfolioAppState, buildPortfolioPosition, buildWorkbookSnapshot, buildWorkbookTable } from '../testing/portfolio-test-builders';
import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';
import { InvestmentMovementsPerformanceService } from './investment-movements-performance.service';
import { MinimumPerformanceService } from './minimum-performance.service';
import { PortfolioMinimumBalanceTrendService } from './portfolio-minimum-balance-trend.service';
import { PortfolioStage3DiagnosticService } from './portfolio-stage3-diagnostic.service';
import { PortfolioCalculatorService } from './portfolio-calculator.service';

describe('PortfolioStage3DiagnosticService', () => {
  let service: PortfolioStage3DiagnosticService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CurrencyMapperService,
        DataNormalizationService,
        InvestmentMovementsPerformanceService,
        PortfolioCalculatorService,
        MinimumPerformanceService,
        PortfolioMinimumBalanceTrendService,
        PortfolioStage3DiagnosticService
      ]
    });

    service = TestBed.inject(PortfolioStage3DiagnosticService);
  });

  it('exports a diagnostic report with comparison, FCI and caucion sections', () => {
    const snapshot = buildPortfolioAppState({
      workbook: buildWorkbookSnapshot({
        tables: [
          buildWorkbookTable({
            name: 'Tabla11',
            displayName: 'Tabla11',
            rows: [{ 'Fondos com. Inv.': 'IOLCAMA' }]
          }),
          buildWorkbookTable({
            name: 'Tabla6',
            displayName: 'Tabla6',
            rows: [
              { ESPECIE: 'TX26', MONEDA: 'ARS', 'CANT.': 10, TOTAL: 1000 },
              { ESPECIE: 'IOLCAMA', MONEDA: 'ARS', 'CANT.': 20, TOTAL: 2000 },
              { ESPECIE: 'CAUCION', MONEDA: 'ARS', 'CANT.': 5, TOTAL: 500 }
            ]
          }),
          buildWorkbookTable({
            name: 'Tabla13',
            displayName: 'Tabla13',
            rows: [
              { ESPECIE: 'CAUCION', MONEDA: 'ARS', 'CANT.': 5, 'PREC. EN V.': 110 }
            ]
          }),
          buildWorkbookTable({
            name: 'Tabla5',
            displayName: 'Tabla5',
            rows: [
              { FECHA: '2026-06-19', ESPECIE: 'TX26', PRECIO: 100 },
              { FECHA: '2026-06-19', ESPECIE: 'IOLCAMA', PRECIO: 200 },
              { FECHA: '2026-06-19', ESPECIE: 'CAUCION', PRECIO: 1 }
            ]
          }),
          buildWorkbookTable({
            name: 'TablaCalendario',
            displayName: 'TablaCalendario',
            rows: [
              { Fecha: '2026-06-01', Indice: 100, TNA: 10, Rend_diaria: 0.01 },
              { Fecha: '2026-06-19', Indice: 110, TNA: 10, Rend_diaria: 0.01 }
            ]
          })
        ]
      }),
      dataset: {
        operations: [
          {
            id: '1',
            date: '2026-06-01',
            symbol: 'TX26',
            currency: 'ARS',
            quantity: 10,
            buyPrice: 100,
            total: 1000,
            currentPrice: 120,
            currentValue: 1200,
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
            symbol: 'TX26',
            currency: 'ARS',
            quantity: 10,
            totalInvested: 1000,
            currentValue: 1200,
            resultAmount: 200,
            resultPercent: 20,
            positionType: 'Accion',
            assetType: 'Accion'
          })
        ],
        historicalPrices: [
          { date: '2026-06-01', month: 'jun-26', symbol: 'TX26', price: 100 },
          { date: '2026-06-19', month: 'jun-26', symbol: 'TX26', price: 120 },
          { date: '2026-06-19', month: 'jun-26', symbol: 'IOLCAMA', price: 200 },
          { date: '2026-06-19', month: 'jun-26', symbol: 'CAUCION', price: 1 }
        ],
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
        calendarBenchmarks: [
          { date: new Date(Date.UTC(2026, 5, 1)), tna: 10, dailyReturnPercent: 0.01, index: 100, source: 'TablaCalendario' },
          { date: new Date(Date.UTC(2026, 5, 19)), tna: 10, dailyReturnPercent: 0.01, index: 110, source: 'TablaCalendario' }
        ]
      }
    });

    const report = service.buildReport(snapshot, '2026-06-19');

    expect(report.summary.balanceActualVsMinimum.balanceVsMinimumARS).not.toBeNull();
    expect(report.fci.some((item) => item.symbol === 'IOLCAMA')).toBeTrue();
    expect(report.caucions.some((item) => item.symbol === 'CAUCION')).toBeTrue();
    expect(report.tables.hasTabla11).toBeTrue();
  });

  it('survives missing Tabla11 and missing caucions', () => {
    const snapshot = buildPortfolioAppState({
      workbook: buildWorkbookSnapshot({
        tables: []
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
        strategicSplit: [],
        platformDistribution: [],
        calendarBenchmarks: []
      }
    });

    const report = service.buildReport(snapshot, '2026-06-19');

    expect(report.tables.hasTabla11).toBeFalse();
    expect(report.fci).toEqual([]);
    expect(report.caucions).toEqual([]);
  });
});
