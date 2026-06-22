import { TestBed } from '@angular/core/testing';

import { PortfolioCalculatorService } from './portfolio-calculator.service';
import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';
import { PrivacyModeService } from './privacy-mode.service';
import {
  buildWorkbookTable,
  buildPortfolioPosition
} from '../testing/portfolio-test-builders';

describe('PortfolioCalculatorService', () => {
  const privacyMode = { enabled: false };
  let service: PortfolioCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CurrencyMapperService,
        DataNormalizationService,
        PortfolioCalculatorService,
        {
          provide: PrivacyModeService,
          useValue: privacyMode
        }
      ]
    });
    service = TestBed.inject(PortfolioCalculatorService);
  });

  it('maps workbook tables into dataset slices', () => {
    const dataset = service.buildDataset([
      buildWorkbookTable({
        name: 'Tabla6',
        displayName: 'Tabla6',
        rows: [
          {
            ID: '1',
            FECHA: '2025-01-05',
            ESPECIE: 'AMD',
            MONEDA: '$',
            'CANT.': 10,
            'PREC. COMP.': 100,
            TOTAL: 1000,
            'PREC. ACT.': 120,
            'VALORI. ACT.': 1200,
            VARIACION: 20,
            'Var_cuenta_rem_%': 0,
            'Valor_cuenta_rem': 0,
            Monto: 1000,
            TEM: 1.5,
            TNA: 12,
            TOP: 'PRECIO',
            TENDENCIA: 'ALCISTA'
          }
        ]
      }),
      buildWorkbookTable({
        name: 'TablaPosiciones',
        displayName: 'TablaPosiciones',
        rows: [
          {
            ESPECIE: 'AMD',
            MONEDA: 'ARS',
            TIPO: 'Accion',
            CANTIDAD: 10,
            'TOTAL INV': 1000,
            'PRECIO ACT': 120,
            'TOTAL ACTUAL': 1200,
            'RESULTADO $': 200,
            'RESULTADO %': 20,
            'PRECIO PROM': 100
          },
          {
            ESPECIE: 'GLD',
            MONEDA: 'U$S',
            TIPO: 'ETF',
            CANTIDAD: 2,
            'TOTAL INV': 400,
            'PRECIO ACT': 250,
            'TOTAL ACTUAL': 500,
            'RESULTADO $': 100,
            'RESULTADO %': 25,
            'PRECIO PROM': 200
          }
        ]
      }),
      buildWorkbookTable({
        name: 'Tabla5',
        displayName: 'Tabla5',
        rows: [
          { FECHA: '2025-01-03', MES: 'ene-25', ESPECIE: 'AMD', PRECIO: 110 },
          { FECHA: '2025-01-01', MES: 'ene-25', ESPECIE: 'AMD', PRECIO: 100 }
        ]
      }),
      buildWorkbookTable({
        name: 'Tabla14',
        displayName: 'Tabla14',
        rows: [
          { FECHA: '2025-01-02', MES: 'ene-25', BALANCE: -50 },
          { FECHA: '2025-01-01', MES: 'ene-25', BALANCE: 100 }
        ]
      }),
      buildWorkbookTable({
        name: 'Tabla47',
        displayName: 'Tabla47',
        rows: [
          { ESPECIE: 'AMD', 'VALORI. ACT.': 1200, Monto: 1000, Esperado: 100, TIPO: 'Accion', SECTOR: 'Tecnologia', SUBSECTOR: 'Semiconductores', REGION: 'Global' }
        ]
      }),
      buildWorkbookTable({
        name: 'HistorialMensualReconstruido',
        displayName: 'HistorialMensualReconstruido',
        rows: [
          { MES: 'ene-25', ValInicio: 900, Compras: 100, Ventas: 10, ValFin: 1000, Resultado: 90, 'VARIACION %': 10, 'Inflacion %': 2, 'Rend. Real %': 8, 'Rend. Real Acum %': 8, 'Ratio Aporte': 0.1, 'Buen Mercado': 'si', 'Buen Aporte': 'si', 'Tipo de Mes': 'normal', Ano: 2025 }
        ]
      }),
      buildWorkbookTable({
        name: 'Tabla35',
        displayName: 'Tabla35',
        rows: [
          {
            FECHA: '2025-01-01',
            'VALOR AR': 1000,
            'VALOR USD': 100,
            '% JUBILACION': 55,
            '% AHORRO': 45,
            'MONTO JUB. AR': 550,
            'MONTO JUB. USD': 55,
            'MONTO AHOR. AR': 450,
            'MONTO AHOR. USD': 45
          }
        ]
      }),
      buildWorkbookTable({
        name: 'Tabla_OrdenesPendientes',
        displayName: 'Tabla_OrdenesPendientes',
        rows: [
          { ESPECIE: 'VIST', Cant: 2, PRECIO: 32000 },
          { ESPECIE: 'META', Cant: 4, PRECIO: 34500 },
          { ESPECIE: 'META', Cant: 4, PRECIO: 35500 }
        ]
      }),
      buildWorkbookTable({
        name: 'TablaCalendario',
        displayName: 'TablaCalendario',
        rows: [
          { FECHA: '2025-01-01', TNA: 10, Rend_diaria: 0.01, Indice: 100 },
          { FECHA: '2025-12-31', TNA: 12, Rend_diaria: 0.01, Indice: 120 }
        ]
      })
    ]);

    expect(dataset.operations.length).toBe(1);
    expect(dataset.operations[0].currency).toBe('ARS');
    expect(dataset.positions.length).toBe(2);
    expect(dataset.positions[1].currency).toBe('USD');
    expect(dataset.historicalPrices.map((item) => item.date)).toEqual(['2025-01-01', '2025-01-03']);
    expect(dataset.dailyBalances.map((item) => item.balance)).toEqual([-50, 100]);
    expect(dataset.strategicSplit[0].retirementPercent).toBe(55);
    expect(dataset.pendingOrders?.totalOrders).toBe(3);
    expect(dataset.pendingOrders?.totalReservedARS).toBe(344000);
    expect(dataset.pendingOrders?.summaryBySymbol.map((item) => item.symbol)).toEqual(['META', 'VIST']);
  });

  it('keeps pending orders separated from positions and current value', () => {
    const dataset = service.buildDataset([
      buildWorkbookTable({
        name: 'TablaPosiciones',
        displayName: 'TablaPosiciones',
        rows: [
          {
            ESPECIE: 'AMD',
            MONEDA: 'ARS',
            TIPO: 'Accion',
            CANTIDAD: 10,
            'TOTAL INV': 1000,
            'PRECIO ACT': 120,
            'TOTAL ACTUAL': 1200,
            'RESULTADO $': 200,
            'RESULTADO %': 20,
            'PRECIO PROM': 100
          }
        ]
      }),
      buildWorkbookTable({
        name: 'Tabla_OrdenesPendientes',
        displayName: 'Tabla_OrdenesPendientes',
        rows: [{ ESPECIE: 'VIST', Cant: 2, PRECIO: 32000 }]
      })
    ]);

    const summary = service.buildSummary(dataset);

    expect(dataset.positions.length).toBe(1);
    expect(dataset.pendingOrders?.totalReservedARS).toBe(64000);
    expect(summary.totalCurrentValue).toBe(1200);
    expect(summary.totalInvested).toBe(1000);
  });

  it('builds portfolio summary totals by currency', () => {
    const positions = [
      buildPortfolioPosition({
        symbol: 'AMD',
        currency: 'ARS',
        currentValue: 1200,
        totalInvested: 1000,
        resultAmount: 200,
        resultPercent: 20
      }),
      buildPortfolioPosition({
        symbol: 'GLD',
        currency: 'USD',
        currentValue: 500,
        totalInvested: 400,
        resultAmount: 100,
        resultPercent: 25
      })
    ];
    const dataset = service.buildDataset([
      buildWorkbookTable({
        name: 'TablaPosiciones',
        displayName: 'TablaPosiciones',
        rows: positions.map((position) => ({
          ESPECIE: position.symbol,
          MONEDA: position.currency,
          TIPO: position.positionType,
          CANTIDAD: position.quantity,
          'TOTAL INV': position.totalInvested,
          'PRECIO ACT': position.currentPrice,
          'TOTAL ACTUAL': position.currentValue,
          'RESULTADO $': position.resultAmount,
          'RESULTADO %': position.resultPercent,
          'PRECIO PROM': position.averagePrice
        }))
      }),
      buildWorkbookTable({
        name: 'Tabla47',
        displayName: 'Tabla47',
        rows: [
          { ESPECIE: 'AMD', 'VALORI. ACT.': 1200, Monto: 1000, Esperado: 100, TIPO: 'Accion', SECTOR: 'Tecnologia', SUBSECTOR: 'Semiconductores', REGION: 'Global' },
          { ESPECIE: 'GLD', 'VALORI. ACT.': 500, Monto: 400, Esperado: 100, TIPO: 'ETF', SECTOR: 'Materias primas', SUBSECTOR: 'Oro', REGION: 'Global' }
        ]
      })
    ]);
    const summary = service.buildSummary(dataset);

    expect(summary.totalCurrentValue).toBe(1700);
    expect(summary.totalInvested).toBe(1400);
    expect(summary.totalResult).toBe(300);
    expect(summary.totalResultPercent).toBeCloseTo(21.43, 2);
    expect(summary.byCurrency.length).toBe(2);
    expect(summary.byCurrency.find((item) => item.currency === 'ARS')?.totalCurrentValue).toBe(1200);
    expect(summary.byCurrency.find((item) => item.currency === 'USD')?.totalCurrentValue).toBe(500);
    expect(summary.largestWeight?.symbol).toBe('AMD');
    expect(summary.bestPosition?.symbol).toBe('GLD');
    expect(summary.worstPosition?.symbol).toBe('AMD');
    expect(summary.speciesCount).toBe(2);
  });

  it('calculates portfolio weights and keeps zero totals stable', () => {
    const enriched = service.enrichPositions([
      buildPortfolioPosition({
        symbol: 'AAA',
        currency: 'ARS',
        currentValue: 700,
        totalInvested: 500,
        resultAmount: 200,
        resultPercent: 40
      }),
      buildPortfolioPosition({
        symbol: 'BBB',
        currency: 'ARS',
        currentValue: 300,
        totalInvested: 250,
        resultAmount: 50,
        resultPercent: 20
      }),
      buildPortfolioPosition({
        symbol: 'CCC',
        currency: 'USD',
        currentValue: 0,
        totalInvested: 0,
        resultAmount: 0,
        resultPercent: 0
      })
    ], []);

    expect(enriched[0].portfolioWeight).toBeCloseTo(70, 2);
    expect(enriched[1].portfolioWeight).toBeCloseTo(30, 2);
    expect(enriched[2].portfolioWeight).toBeCloseTo(0, 2);
  });

  it('keeps summary percentages finite when invested capital is zero', () => {
    const dataset = service.buildDataset([
      buildWorkbookTable({
        name: 'TablaPosiciones',
        displayName: 'TablaPosiciones',
        rows: [
          {
            ESPECIE: 'AAA',
            MONEDA: 'ARS',
            TIPO: 'Accion',
            CANTIDAD: 10,
            'TOTAL INV': 0,
            'PRECIO ACT': 100,
            'TOTAL ACTUAL': 1000,
            'RESULTADO $': 1000,
            'RESULTADO %': 0,
            'PRECIO PROM': 0
          }
        ]
      })
    ]);

    const summary = service.buildSummary(dataset);

    expect(summary.totalInvested).toBe(0);
    expect(summary.totalResultPercent).toBe(0);
    expect(Number.isFinite(summary.totalResultPercent)).toBeTrue();
  });

  it('keeps negative results as negative percentages', () => {
    const dataset = service.buildDataset([
      buildWorkbookTable({
        name: 'TablaPosiciones',
        displayName: 'TablaPosiciones',
        rows: [
          {
            ESPECIE: 'AAA',
            MONEDA: 'ARS',
            TIPO: 'Accion',
            CANTIDAD: 10,
            'TOTAL INV': 1000,
            'PRECIO ACT': 80,
            'TOTAL ACTUAL': 800,
            'RESULTADO $': -200,
            'RESULTADO %': -20,
            'PRECIO PROM': 100
          }
        ]
      })
    ]);

    const summary = service.buildSummary(dataset);

    expect(summary.totalResult).toBe(-200);
    expect(summary.totalResultPercent).toBeCloseTo(-20, 2);
  });
});
