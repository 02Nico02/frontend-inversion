import { Injectable } from '@angular/core';
import { DataNormalizationService } from './data-normalization.service';
import { PendingOrder, PendingOrdersSummary, PendingOrderSummaryBySymbol } from '../models/pending-orders.model';
import { WorkbookTableData } from '../models/workbook.models';

@Injectable({ providedIn: 'root' })
export class PendingOrdersService {
  constructor(private readonly normalization: DataNormalizationService) {}

  buildSummary(table: WorkbookTableData | null): PendingOrdersSummary {
    if (!table) {
      return this.emptySummary();
    }

    const warnings: string[] = [];
    const orders: PendingOrder[] = [];

    for (const row of table.rows ?? []) {
      const symbol = this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE'])) ?? '';
      const quantity = this.normalization.asNumber(this.normalization.pickValue(row, ['Cant', 'CANT', 'CANT.', 'Cantidad']));
      const limitPriceARS = this.normalization.asNumber(this.normalization.pickValue(row, ['PRECIO', 'PREC.', 'PRECIO LIMITE', 'PRECIO LÍMITE']));

      if (!symbol || quantity === null || quantity <= 0 || limitPriceARS === null || limitPriceARS <= 0) {
        warnings.push(`Fila omitida en ${table.name || 'Tabla_OrdenesPendientes'} por datos incompletos o inválidos.`);
        continue;
      }

      orders.push({
        symbol,
        quantity,
        limitPriceARS,
        reservedAmountARS: quantity * limitPriceARS
      });
    }

    return this.aggregate(orders, warnings);
  }

  buildFromOrders(orders: PendingOrder[], warnings: string[] = []): PendingOrdersSummary {
    return this.aggregate(orders, warnings);
  }

  private aggregate(orders: PendingOrder[], warnings: string[]): PendingOrdersSummary {
    const summaryBySymbolMap = new Map<string, PendingOrderSummaryBySymbol>();
    for (const order of orders) {
      const key = order.symbol.trim().toUpperCase();
      const current = summaryBySymbolMap.get(key) ?? {
        symbol: key,
        totalQuantity: 0,
        totalReservedARS: 0,
        averageLimitPriceARS: 0,
        ordersCount: 0
      };
      current.totalQuantity += order.quantity;
      current.totalReservedARS += order.reservedAmountARS;
      current.ordersCount += 1;
      current.averageLimitPriceARS = current.totalQuantity > 0 ? current.totalReservedARS / current.totalQuantity : 0;
      summaryBySymbolMap.set(key, current);
    }

    const summaryBySymbol = [...summaryBySymbolMap.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
    const totalReservedARS = orders.reduce((sum, order) => sum + order.reservedAmountARS, 0);

    return {
      orders,
      summaryBySymbol,
      totalOrders: orders.length,
      totalReservedARS,
      cashTreatment: 'reserved_not_available_cash',
      includedInCurrentPositions: false,
      includedInAvailableCash: false,
      warnings: this.uniqueWarnings(warnings)
    };
  }

  private emptySummary(): PendingOrdersSummary {
    return {
      orders: [],
      summaryBySymbol: [],
      totalOrders: 0,
      totalReservedARS: 0,
      cashTreatment: 'reserved_not_available_cash',
      includedInCurrentPositions: false,
      includedInAvailableCash: false,
      warnings: []
    };
  }

  private uniqueWarnings(warnings: string[]): string[] {
    return [...new Set(warnings.map((item) => String(item ?? '').trim()).filter(Boolean))];
  }
}
