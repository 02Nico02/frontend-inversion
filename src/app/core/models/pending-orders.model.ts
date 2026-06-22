export interface PendingOrder {
  symbol: string;
  quantity: number;
  limitPriceARS: number;
  reservedAmountARS: number;
}

export interface PendingOrderSummaryBySymbol {
  symbol: string;
  totalQuantity: number;
  totalReservedARS: number;
  averageLimitPriceARS: number;
  ordersCount: number;
}

export interface PendingOrdersSummary {
  orders: PendingOrder[];
  summaryBySymbol: PendingOrderSummaryBySymbol[];
  totalOrders: number;
  totalReservedARS: number;
  cashTreatment: 'reserved_not_available_cash';
  includedInCurrentPositions: false;
  includedInAvailableCash: false;
  warnings: string[];
}
