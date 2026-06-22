import { TestBed } from '@angular/core/testing';

import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';
import { PendingOrdersService } from './pending-orders.service';
import { buildWorkbookTable } from '../testing/portfolio-test-builders';

describe('PendingOrdersService', () => {
  let service: PendingOrdersService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CurrencyMapperService, DataNormalizationService, PendingOrdersService]
    });
    service = TestBed.inject(PendingOrdersService);
  });

  it('maps Tabla_OrdenesPendientes rows into pending orders and reserves capital', () => {
    const summary = service.buildSummary(
      buildWorkbookTable({
        name: 'Tabla_OrdenesPendientes',
        displayName: 'Tabla_OrdenesPendientes',
        rows: [
          { ESPECIE: 'VIST', Cant: 2, PRECIO: 32000 },
          { ESPECIE: 'MSFT', Cant: 8, PRECIO: 18500 }
        ]
      })
    );

    expect(summary.totalOrders).toBe(2);
    expect(summary.totalReservedARS).toBe(212000);
    expect(summary.orders[0]).toEqual({
      symbol: 'VIST',
      quantity: 2,
      limitPriceARS: 32000,
      reservedAmountARS: 64000
    });
    expect(summary.orders[1]).toEqual({
      symbol: 'MSFT',
      quantity: 8,
      limitPriceARS: 18500,
      reservedAmountARS: 148000
    });
    expect(summary.summaryBySymbol).toEqual([
      {
        symbol: 'MSFT',
        totalQuantity: 8,
        totalReservedARS: 148000,
        averageLimitPriceARS: 18500,
        ordersCount: 1
      },
      {
        symbol: 'VIST',
        totalQuantity: 2,
        totalReservedARS: 64000,
        averageLimitPriceARS: 32000,
        ordersCount: 1
      }
    ]);
    expect(summary.cashTreatment).toBe('reserved_not_available_cash');
    expect(summary.includedInCurrentPositions).toBeFalse();
    expect(summary.includedInAvailableCash).toBeFalse();
  });

  it('groups repeated symbols with weighted average limit price', () => {
    const summary = service.buildSummary(
      buildWorkbookTable({
        name: 'Tabla_OrdenesPendientes',
        displayName: 'Tabla_OrdenesPendientes',
        rows: [
          { ESPECIE: 'META', Cant: 4, PRECIO: 34500 },
          { ESPECIE: 'META', Cant: 4, PRECIO: 35500 }
        ]
      })
    );

    expect(summary.totalOrders).toBe(2);
    expect(summary.totalReservedARS).toBe(280000);
    expect(summary.summaryBySymbol).toEqual([
      {
        symbol: 'META',
        totalQuantity: 8,
        totalReservedARS: 280000,
        averageLimitPriceARS: 35000,
        ordersCount: 2
      }
    ]);
  });

  it('skips invalid rows with warnings', () => {
    const summary = service.buildSummary(
      buildWorkbookTable({
        name: 'Tabla_OrdenesPendientes',
        displayName: 'Tabla_OrdenesPendientes',
        rows: [
          { ESPECIE: 'VIST', Cant: 2, PRECIO: 32000 },
          { ESPECIE: '', Cant: 8, PRECIO: 18500 },
          { ESPECIE: 'META', Cant: 0, PRECIO: 35500 }
        ]
      })
    );

    expect(summary.totalOrders).toBe(1);
    expect(summary.totalReservedARS).toBe(64000);
    expect(summary.warnings.length).toBeGreaterThan(0);
  });
});
