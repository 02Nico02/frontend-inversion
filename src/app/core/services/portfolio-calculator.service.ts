import { Injectable } from '@angular/core';
import {
  AnnualInvestmentSummary,
  AssetClassification,
  CalculatedAlert,
  CalendarBenchmarkRow,
  DailyBalance,
  HistoricalPrice,
  InvestmentOperation,
  InvestmentMovement,
  InvestmentSale,
  ManualAlert,
  MarketSignal,
  MonthlyInvestmentSummary,
  MonthlyPerformanceRow,
  PlatformDistribution,
  PortfolioDataset,
  PortfolioPosition,
  PortfolioSummary,
  StrategicSplit
} from '../models/portfolio.models';
import { WorkbookTableData } from '../models/workbook.models';
import { DataNormalizationService } from './data-normalization.service';
import { CanonicalCurrency, CurrencyMapperService } from './currency-mapper.service';
import { parseCalendarDailyPercent, parseCalendarIndex, parseCalendarTna } from '../utils/value-parsing.utils';
import { PendingOrdersService } from './pending-orders.service';

@Injectable({ providedIn: 'root' })
export class PortfolioCalculatorService {
  constructor(
    private readonly normalization: DataNormalizationService,
    private readonly currencyMapper: CurrencyMapperService,
    private readonly pendingOrdersService: PendingOrdersService
  ) {}

  buildDataset(tables: WorkbookTableData[]): PortfolioDataset {
    const operations = this.mapOperations(this.findTable(tables, ['Tabla6']));
    const investmentMovements = this.mapInvestmentMovements(this.findTable(tables, ['TablaMovimientosInversiones']));
    const sales = this.mapSales(this.findTable(tables, ['Tabla13']));
    const positions = this.mapPositions(this.findTable(tables, ['TablaPosiciones']), operations);
    const historicalPrices = this.mapHistoricalPrices(this.findTable(tables, ['Tabla5']));
    const dailyBalances = this.mapDailyBalances(this.findTable(tables, ['Tabla14']));
    const classifications = this.mapClassifications(this.findTable(tables, ['Tabla47']));
    const manualAlerts = this.mapManualAlerts(this.findTable(tables, ['ObjetivosPorEspecie']));
    const calculatedAlerts = this.mapCalculatedAlerts([
      this.findTable(tables, ['AlertasSuperoElMaximo']),
      this.findTable(tables, ['AlertasDebajoDelMinimo'])
    ]);
    const signals = this.mapSignals([
      this.findTable(tables, ['AlertasEspeciesEnCaida_5D', 'EspeciesEnCaida_5D']),
      this.findTable(tables, ['EspeciesEnRecuperacion_5D']),
      this.findTable(tables, ['EspeciesEnCaida_30D']),
      this.findTable(tables, ['EspeciesEnRecuperacion_30D'])
    ]);
    const monthlySummary = this.mapMonthlySummary(this.findTable(tables, ['HistorialMensualReconstruido']));
    const annualSummary = this.mapAnnualSummary(this.findTable(tables, ['Tabla60']));
    const monthlyPerformance = this.mapMonthlyPerformance(this.findTable(tables, ['Tabla9']));
    const strategicSplit = this.mapStrategicSplit(this.findTable(tables, ['Tabla35']));
    const platformDistribution = this.mapPlatforms(this.findTable(tables, ['Tabla38']));
    const pendingOrders = this.pendingOrdersService.buildSummary(this.findTable(tables, ['Tabla_OrdenesPendientes']));
    const calendarBenchmarks = [
      ...this.mapCalendarBenchmark(this.findTable(tables, ['TablaCalendario']), 'TablaCalendario'),
      ...this.mapCalendarBenchmark(this.findTable(tables, ['TablaCalendarioRem']), 'TablaCalendarioRem'),
      ...this.mapCalendarBenchmark(this.findTable(tables, ['TablaCalendarioInf']), 'TablaCalendarioInf')
    ];

    return {
      operations,
      sales,
      investmentMovements,
      positions,
      historicalPrices,
      dailyBalances,
      classifications,
      manualAlerts,
      calculatedAlerts,
      signals,
      monthlySummary,
      annualSummary,
      monthlyPerformance,
      strategicSplit,
      platformDistribution,
      calendarBenchmarks,
      pendingOrders
    };
  }

  buildSummary(dataset: PortfolioDataset): PortfolioSummary {
    const positions = this.enrichPositions(dataset.positions, dataset.classifications);
    const totalCurrentValue = positions.reduce((sum, position) => sum + position.currentValue, 0);
    const totalInvested = positions.reduce((sum, position) => sum + position.totalInvested, 0);
    const totalResult = totalCurrentValue - totalInvested;
    const totalResultPercent = totalInvested > 0 ? (totalResult / totalInvested) * 100 : 0;
    const byCurrency = this.aggregateByCurrency(positions);
    const bestPosition = positions.reduce<PortfolioPosition | null>((best, current) => {
      if (!best) return current;
      return (current.resultPercent ?? -Infinity) > (best.resultPercent ?? -Infinity) ? current : best;
    }, null);
    const worstPosition = positions.reduce<PortfolioPosition | null>((worst, current) => {
      if (!worst) return current;
      return (current.resultPercent ?? Infinity) < (worst.resultPercent ?? Infinity) ? current : worst;
    }, null);
    const largestWeight = positions.reduce<PortfolioPosition | null>((largest, current) => {
      if (!largest) return current;
      return (current.portfolioWeight ?? 0) > (largest.portfolioWeight ?? 0) ? current : largest;
    }, null);
    const speciesCount = new Set(positions.map((position) => position.symbol)).size;
    const latestBalanceEntry =
      [...dataset.dailyBalances]
        .filter((entry) => entry.balance !== null && entry.balance !== undefined)
        .sort((a, b) => {
          const da = this.normalization.asDate(a.date)?.getTime() ?? 0;
          const db = this.normalization.asDate(b.date)?.getTime() ?? 0;
          return da - db;
        })
        .at(-1) ?? null;

    return {
      totalCurrentValue,
      totalInvested,
      totalResult,
      totalResultPercent,
      byCurrency,
      bestPosition,
      worstPosition,
      largestWeight,
      speciesCount,
      latestBalance: latestBalanceEntry?.balance ?? null,
      latestBalanceDate: latestBalanceEntry?.date ?? null
    };
  }

  enrichPositions(positions: PortfolioPosition[], classifications: AssetClassification[]): PortfolioPosition[] {
    const classificationBySymbol = new Map(classifications.map((item) => [item.symbol.toUpperCase(), item]));
    const enriched = positions.map((position) => {
      const classification = classificationBySymbol.get(position.symbol.toUpperCase()) ?? null;
      return {
        ...position,
        classification,
        assetType: classification?.type ?? position.assetType ?? null,
        sector: classification?.sector ?? position.sector ?? null,
        subsector: classification?.subsector ?? position.subsector ?? null,
        region: classification?.region ?? position.region ?? null
      };
    });
    const totalCurrentValue = enriched.reduce((sum, position) => sum + position.currentValue, 0);
    return enriched.map((position) => ({
      ...position,
      portfolioWeight: totalCurrentValue > 0 ? (position.currentValue / totalCurrentValue) * 100 : 0
    }));
  }

  private findTable(tables: WorkbookTableData[], aliases: string[]): WorkbookTableData | null {
    const normalizedAliases = aliases.map((alias) => this.normalization.normalizeHeader(alias));
    return (
      tables.find(
        (table) =>
          normalizedAliases.includes(this.normalization.normalizeHeader(table.name)) ||
          normalizedAliases.includes(this.normalization.normalizeHeader(table.displayName))
      ) ?? null
    );
  }

  private mapOperations(table: WorkbookTableData | null): InvestmentOperation[] {
    if (!table) {
      return [];
    }
    return table.rows
      .map((row, index) => ({
        id: String(this.normalization.pickValue(row, ['ID']) ?? index + 1),
        date: this.normalization.asIsoDate(this.normalization.pickValue(row, ['Fecha', 'FECHA'])),
        symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE'])) ?? '',
        currency: this.currencyMapper.normalizeCurrency(this.normalization.pickValue(row, ['MONEDA'])),
        quantity: this.normalization.asNumber(this.normalization.pickValue(row, ['CANT.', 'CANTIDAD'])),
        buyPrice: this.normalization.asNumber(this.normalization.pickValue(row, ['PREC. COMP.'])),
        total: this.normalization.asNumber(this.normalization.pickValue(row, ['TOTAL'])),
        currentPrice: this.normalization.asNumber(this.normalization.pickValue(row, ['PREC. ACT.'])),
        currentValue: this.normalization.asNumber(this.normalization.pickValue(row, ['VALORI. ACT.'])),
        variation: this.normalization.asPercent(this.normalization.pickValue(row, ['VARIACION', 'VARIACION %'])),
        remVariation: this.normalization.asPercent(this.normalization.pickValue(row, ['Var_cuenta_rem_%'])),
        remValue: this.normalization.asNumber(this.normalization.pickValue(row, ['Valor_cuenta_rem'])),
        amount: this.normalization.asNumber(this.normalization.pickValue(row, ['Monto'])),
        monthlyRate: this.normalization.asPercent(this.normalization.pickValue(row, ['TEM'])),
        annualRate: this.normalization.asPercent(this.normalization.pickValue(row, ['TNA'])),
        top: this.normalization.asText(this.normalization.pickValue(row, ['TOP'])),
        trend: this.normalization.asText(this.normalization.pickValue(row, ['TENDENCIA'])),
        sourceTable: table.name
      }))
      .filter((item) => item.symbol);
  }

  private mapInvestmentMovements(table: WorkbookTableData | null): InvestmentMovement[] {
    if (!table) {
      return [];
    }

    return table.rows
      .map((row) => {
        const capitalText = this.normalization.asText(this.normalization.pickValue(row, ['Afecta capital invertido']));
        const affectsInvestedCapital = this.parseMovementBoolean(capitalText);

        return {
          date: this.normalization.asDate(this.normalization.pickValue(row, ['Fecha'])),
          symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['Especie'])) ?? '',
          currency: this.currencyMapper.normalizeCurrency(this.normalization.pickValue(row, ['Moneda', 'MONEDA'])),
          type: this.normalization.asText(this.normalization.pickValue(row, ['Tipo movimiento'])) ?? '',
          amount: this.normalization.asNumber(this.normalization.pickValue(row, ['Monto'])),
          affectsPerformance: this.parseMovementBoolean(
            this.normalization.asText(this.normalization.pickValue(row, ['Afecta rendimiento']))
          ),
          affectsInvestedCapital,
          capitalEffect: affectsInvestedCapital ? this.parseCapitalEffect(capitalText) : 'none',
          note: this.normalization.asText(this.normalization.pickValue(row, ['Observación', 'Observacion']))
        };
      })
      .filter((item) => item.symbol);
  }

  private mapSales(table: WorkbookTableData | null): InvestmentSale[] {
    if (!table) {
      return [];
    }
    return table.rows
      .map((row, index) => ({
        id: String(this.normalization.pickValue(row, ['ID']) ?? index + 1),
        buyDate: this.normalization.asIsoDate(
          this.normalization.pickValue(row, ['Fecha Com.', 'Fecha Compra', 'Fecha compra']) ?? this.normalization.pickValueByTokens(row, ['FECHA', 'COM'])
        ),
        sellDate: this.normalization.asIsoDate(
          this.normalization.pickValue(row, ['Fecha Vent.', 'Fecha Venta', 'Fecha venta']) ?? this.normalization.pickValueByTokens(row, ['FECHA', 'VENT'])
        ),
        symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE'])) ?? '',
        currency: this.currencyMapper.normalizeCurrency(this.normalization.pickValue(row, ['MONEDA'])),
        quantity: this.normalization.asNumber(this.normalization.pickValue(row, ['CANT.', 'CANTIDAD'])),
        buyPrice: this.normalization.asNumber(
          this.normalization.pickValue(row, ['PREC. COMP.', 'PRECIO COMPRA', 'PREC COMPRA']) ?? this.normalization.pickValueByTokens(row, ['PREC', 'COMP'])
        ),
        total: this.normalization.asNumber(this.normalization.pickValue(row, ['TOTAL', 'Monto', 'MONTO'])),
        sellPrice: this.normalization.asNumber(
          this.normalization.pickValue(row, ['PREC. EN V.', 'PREC. V.', 'PRECIO VENTA', 'PREC VENTA']) ?? this.normalization.pickValueByTokens(row, ['PREC', 'V'])
        ),
        currentValue: this.normalization.asNumber(this.normalization.pickValue(row, ['VALORI. ACT.', 'VALOR ACTUAL'])),
        variation: this.normalization.asPercent(this.normalization.pickValue(row, ['VARIACION', 'VARIACIÓN', 'VARIACION %', 'Variacion %', 'Variación %'])),
        amount: this.normalization.asNumber(this.normalization.pickValue(row, ['Monto', 'MONTO'])),
        minimumObjective: this.normalization.asNumber(
          this.normalization.pickValue(row, ['Objetivo mínimo', 'Objetivo mínimo', 'OBJETIVO MINIMO', 'OBJETIVO MÍNIMO']) ?? this.normalization.pickValueByTokens(row, ['OBJETIVO', 'MIN'])
        ),
        sourceTable: table.name
      }))
      .filter((item) => item.symbol);
  }

  private mapPositions(table: WorkbookTableData | null, operations: InvestmentOperation[]): PortfolioPosition[] {
    if (!table) {
      return this.calculatePositionsFromOperations(operations);
    }
    return table.rows
      .map((row) => ({
        symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE'])) ?? '',
        currency: this.currencyMapper.normalizeCurrency(this.normalization.pickValue(row, ['MONEDA'])),
        positionType: this.normalization.asText(this.normalization.pickValue(row, ['TIPO'])) ?? 'Sin clasificar',
        assetType: null,
        quantity: this.normalization.asNumber(this.normalization.pickValue(row, ['CANTIDAD'])) ?? 0,
        totalInvested: this.normalization.asNumber(this.normalization.pickValue(row, ['TOTAL INV'])) ?? 0,
        currentPrice: this.normalization.asNumber(this.normalization.pickValue(row, ['PRECIO ACT'])),
        currentValue: this.normalization.asNumber(this.normalization.pickValue(row, ['TOTAL ACTUAL'])) ?? 0,
        resultAmount: this.normalization.asNumber(this.normalization.pickValue(row, ['RESULTADO $'])) ?? 0,
        resultPercent: this.normalization.asPercent(this.normalization.pickValue(row, ['RESULTADO %'])),
        averagePrice: this.normalization.asNumber(this.normalization.pickValue(row, ['PRECIO PROM'])),
        portfolioWeight: undefined
      }))
      .filter((item) => item.symbol);
  }

  private calculatePositionsFromOperations(operations: InvestmentOperation[]): PortfolioPosition[] {
    const grouped = new Map<string, InvestmentOperation[]>();
    for (const operation of operations) {
      const bucket = grouped.get(operation.symbol) ?? [];
      bucket.push(operation);
      grouped.set(operation.symbol, bucket);
    }

    const positions: PortfolioPosition[] = [];
    grouped.forEach((group, symbol) => {
      const totalInvested = group.reduce((sum, item) => sum + (item.total ?? item.amount ?? 0), 0);
      const currentValue = group.reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
      const quantity = group.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
      const currentPrice = group.at(-1)?.currentPrice ?? null;
      const averagePrice = quantity > 0 ? totalInvested / quantity : null;
      const resultAmount = currentValue - totalInvested;
      const resultPercent = totalInvested > 0 ? (resultAmount / totalInvested) * 100 : null;
      positions.push({
        symbol,
        currency: group.at(-1)?.currency ?? 'UNKNOWN',
        positionType: 'Sin clasificar',
        assetType: null,
        quantity,
        totalInvested,
        currentPrice,
        currentValue,
        resultAmount,
        resultPercent,
        averagePrice,
        portfolioWeight: undefined
      });
    });
    const totalCurrentValue = positions.reduce((sum, position) => sum + position.currentValue, 0);
    return positions.map((position) => ({
      ...position,
      portfolioWeight: totalCurrentValue > 0 ? (position.currentValue / totalCurrentValue) * 100 : 0
    }));
  }

  private mapHistoricalPrices(table: WorkbookTableData | null): HistoricalPrice[] {
    if (!table) {
      return [];
    }
    return table.rows
      .map((row) => ({
        date: this.normalization.asIsoDate(this.normalization.pickValue(row, ['FECHA'])),
        month: this.normalization.asText(this.normalization.pickValue(row, ['MES'])),
        symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE'])) ?? '',
        price: this.normalization.asNumber(this.normalization.pickValue(row, ['PRECIO']))
      }))
      .filter((item) => item.symbol && item.price !== null)
      .sort((a, b) => {
        const left = this.normalization.asDate(a.date)?.getTime() ?? 0;
        const right = this.normalization.asDate(b.date)?.getTime() ?? 0;
        return left - right;
      });
  }

  private mapDailyBalances(table: WorkbookTableData | null): DailyBalance[] {
    if (!table) {
      return [];
    }
    return table.rows.map((row) => ({
      date: this.normalization.asIsoDate(this.normalization.pickValue(row, ['FECHA'])),
      month: this.normalization.asText(this.normalization.pickValue(row, ['MES'])),
      balance: this.normalization.asNumber(this.normalization.pickValue(row, ['BALANCE']))
    }));
  }

  private mapCalendarBenchmark(
    table: WorkbookTableData | null,
    source: CalendarBenchmarkRow['source']
  ): CalendarBenchmarkRow[] {
    if (!table) {
      return [];
    }

    return table.rows
      .map((row) => {
        const date = this.normalization.asDate(this.normalization.pickValue(row, ['Fecha', 'FECHA']));
        if (!date) {
          return null;
        }
        const tna = source === 'TablaCalendarioInf'
          ? null
          : parseCalendarTna(this.normalization.pickValue(row, ['TNA']));
        const dailyReturnPercent = source === 'TablaCalendarioInf'
          ? parseCalendarDailyPercent(this.normalization.pickValue(row, ['Rend_diaria_inf', 'Rend_diaria']))
          : parseCalendarDailyPercent(this.normalization.pickValue(row, ['Rend_diaria', 'Rend_diaria_inf']));
        const index = source === 'TablaCalendarioInf'
          ? parseCalendarIndex(this.normalization.pickValue(row, ['Indice_inf', 'Indice']))
          : parseCalendarIndex(this.normalization.pickValue(row, ['Indice', 'Indice_inf']));

        return {
          date,
          tna,
          dailyReturnPercent,
          index,
          source
        };
      })
      .filter((item): item is CalendarBenchmarkRow => Boolean(item))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private mapClassifications(table: WorkbookTableData | null): AssetClassification[] {
    if (!table) {
      return [];
    }
    return table.rows
      .map((row) => ({
        symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE'])) ?? '',
        currentValue: this.normalization.asNumber(this.normalization.pickValue(row, ['VALORI. ACT.'])),
        amount: this.normalization.asNumber(this.normalization.pickValue(row, ['Monto'])),
        expected: this.normalization.asNumber(this.normalization.pickValue(row, ['Esperado'])),
        type: this.normalization.asText(this.normalization.pickValue(row, ['TIPO'])),
        sector: this.normalization.asText(this.normalization.pickValue(row, ['SECTOR'])),
        subsector: this.normalization.asText(this.normalization.pickValue(row, ['SUBSECTOR'])),
        region: this.normalization.asText(this.normalization.pickValue(row, ['REGION']))
      }))
      .filter((item) => item.symbol);
  }

  private mapManualAlerts(table: WorkbookTableData | null): ManualAlert[] {
    if (!table) {
      return [];
    }
    return table.rows
      .map((row) => ({
        symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['Especie', 'ESPECIE'])) ?? '',
        condition: this.normalization.asText(this.normalization.pickValue(row, ['Condicion', 'CONDICION'])),
        targetPrice: this.normalization.asNumber(this.normalization.pickValue(row, ['Precio objetivo', 'PRECIO OBJETIVO'])),
        notes: this.normalization.asText(this.normalization.pickValue(row, ['Notas', 'NOTAS'])),
        status: this.normalization.asText(this.normalization.pickValue(row, ['Estado', 'ESTADO']))
      }))
      .filter((item) => item.symbol);
  }

  private mapCalculatedAlerts(tables: Array<WorkbookTableData | null>): CalculatedAlert[] {
    const alerts: CalculatedAlert[] = [];
    for (const table of tables) {
      if (!table) continue;
      alerts.push(
        ...table.rows
          .map((row) => ({
            symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['Especie', 'ESPECIE'])) ?? '',
            date: this.normalization.asIsoDate(this.normalization.pickValue(row, ['Fecha'])),
            currentPrice: this.normalization.asNumber(this.normalization.pickValue(row, ['PrecioActual'])),
            target: this.normalization.asNumber(this.normalization.pickValue(row, ['Objetivo'])),
            alert: this.normalization.asText(this.normalization.pickValue(row, ['Alerta'])),
            sourceTable: table.name
          }))
          .filter((item) => item.symbol)
      );
    }
    return alerts;
  }

  private mapSignals(tables: Array<WorkbookTableData | null>): MarketSignal[] {
    const signals: MarketSignal[] = [];
    for (const table of tables) {
      if (!table) continue;
      const period = /30D/i.test(table.name) ? '30D' : '5D';
      const signalType = /RECUPERACION/i.test(table.name) ? 'recuperacion' : 'caida';
      signals.push(
        ...table.rows
          .map((row) => ({
            symbol: this.normalization.normalizeSymbol(this.normalization.pickValue(row, ['ESPECIE'])) ?? '',
            startDate: this.normalization.asIsoDate(
              this.normalization.pickValue(row, ['Fecha Inicio']) ?? this.normalization.pickValueByTokens(row, ['FECHA', 'INICIO'])
            ),
            startPrice: this.normalization.asNumber(
              this.normalization.pickValue(row, ['Precio Inicio']) ?? this.normalization.pickValueByTokens(row, ['PRECIO', 'INICIO'])
            ),
            endDate: this.normalization.asIsoDate(
              this.normalization.pickValue(row, ['Fecha Fin']) ?? this.normalization.pickValueByTokens(row, ['FECHA', 'FIN'])
            ),
            endPrice: this.normalization.asNumber(
              this.normalization.pickValue(row, ['Precio Fin']) ?? this.normalization.pickValueByTokens(row, ['PRECIO', 'FIN'])
            ),
            variationPercent: this.normalization.asPercent(this.normalization.pickValue(row, ['Variacion %'])),
            period,
            signalType
          }))
          .filter((item) => item.symbol)
      );
    }
    return signals;
  }

  private mapMonthlySummary(table: WorkbookTableData | null): MonthlyInvestmentSummary[] {
    if (!table) {
      return [];
    }
    return table.rows.map((row) => ({
      month: this.normalization.asText(this.normalization.pickValue(row, ['MES'])) ?? '',
      startValue: this.normalization.asNumber(this.normalization.pickValue(row, ['ValInicio'])),
      purchases: this.normalization.asNumber(this.normalization.pickValue(row, ['Compras'])),
      sales: this.normalization.asNumber(this.normalization.pickValue(row, ['Ventas'])),
      endValue: this.normalization.asNumber(this.normalization.pickValue(row, ['ValFin'])),
      result: this.normalization.asNumber(this.normalization.pickValue(row, ['Resultado'])),
      variationPercent: this.normalization.asNumber(this.normalization.pickValue(row, ['Variacion %'])),
      inflationPercent: this.normalization.asNumber(this.normalization.pickValue(row, ['Inflacion %'])),
      realReturnPercent: this.normalization.asNumber(this.normalization.pickValue(row, ['Rend. Real %'])),
      accumulatedRealReturnPercent: this.normalization.asNumber(this.normalization.pickValue(row, ['Rend. Real Acum %'])),
      contributionRatio: this.normalization.asNumber(this.normalization.pickValue(row, ['Ratio Aporte'])),
      goodMarket: this.normalization.asText(this.normalization.pickValue(row, ['Buen Mercado'])),
      goodContribution: this.normalization.asText(this.normalization.pickValue(row, ['Buen Aporte'])),
      monthType: this.normalization.asText(this.normalization.pickValue(row, ['Tipo de Mes'])),
      year: this.normalization.asNumber(this.normalization.pickValue(row, ['Ano']))
    }));
  }

  private mapAnnualSummary(table: WorkbookTableData | null): AnnualInvestmentSummary[] {
    if (!table) {
      return [];
    }
    return table.rows.map((row) => ({
      year: this.normalization.asNumber(this.normalization.pickValue(row, ['Ano'])),
      startValue: this.normalization.asNumber(this.normalization.pickValue(row, ['Val Inicio'])),
      purchases: this.normalization.asNumber(this.normalization.pickValue(row, ['Compras'])),
      sales: this.normalization.asNumber(this.normalization.pickValue(row, ['Ventas'])),
      endValue: this.normalization.asNumber(this.normalization.pickValue(row, ['Val Fin'])),
      result: this.normalization.asNumber(this.normalization.pickValue(row, ['Resultado'])),
      returnPercent: this.normalization.asNumber(this.normalization.pickValue(row, ['Rend. %'])),
      inflation: this.normalization.asNumber(this.normalization.pickValue(row, ['Inflacion'])),
      realReturn: this.normalization.asNumber(this.normalization.pickValue(row, ['Rend. Real'])),
      contributionRatio: this.normalization.asNumber(this.normalization.pickValue(row, ['Ratio Aporte']))
    }));
  }

  private mapMonthlyPerformance(table: WorkbookTableData | null): MonthlyPerformanceRow[] {
    if (!table) {
      return [];
    }
    return table.rows
      .map((row) => ({
        month: this.normalization.asText(this.normalization.pickValue(row, ['MES'])) ?? '',
        monthlyTotal: this.normalization.asNumber(this.normalization.pickValue(row, ['TOTAL DEL MES'])),
        accumulated: this.normalization.asNumber(this.normalization.pickValue(row, ['ACUMULADO'])),
        startValue: this.normalization.asNumber(this.normalization.pickValue(row, ['Val. Inicio'])),
        variationPercent: this.normalization.asNumber(this.normalization.pickValue(row, ['VARIACIÓN %', 'VARIACION %'])),
        realReturnPercent: this.normalization.asNumber(this.normalization.pickValue(row, ['REND. REAL']))
      }))
      .filter((item) => item.month && !/^total$/i.test(item.month));
  }

  private mapStrategicSplit(table: WorkbookTableData | null): StrategicSplit[] {
    if (!table) {
      return [];
    }
    return table.rows.map((row) => ({
      date: this.normalization.asIsoDate(this.normalization.pickValue(row, ['FECHA'])),
      valueARS: this.normalization.asNumber(this.normalization.pickValue(row, ['VALOR AR'])),
      valueUSD: this.normalization.asNumber(this.normalization.pickValue(row, ['VALOR USD'])),
      retirementPercent: this.normalization.asPercent(this.normalization.pickValue(row, ['% JUBILACION'])),
      savingsPercent: this.normalization.asPercent(this.normalization.pickValue(row, ['% AHORRO'])),
      retirementAmountARS: this.normalization.asNumber(this.normalization.pickValue(row, ['MONTO JUB. AR'])),
      retirementAmountUSD: this.normalization.asNumber(this.normalization.pickValue(row, ['MONTO JUB. USD'])),
      savingsAmountARS: this.normalization.asNumber(this.normalization.pickValue(row, ['MONTO AHOR. AR'])),
      savingsAmountUSD: this.normalization.asNumber(this.normalization.pickValue(row, ['MONTO AHOR. USD']))
    }));
  }

  private mapPlatforms(table: WorkbookTableData | null): PlatformDistribution[] {
    if (!table) {
      return [];
    }
    return table.rows
      .map((row) => ({
      platform: this.normalization.asText(this.normalization.pickValue(row, ['Plataforma'])) ?? '',
      amount: this.normalization.asNumber(this.normalization.pickValue(row, ['Monto'])),
      currency: this.currencyMapper.normalizeCurrency(this.normalization.pickValue(row, ['moneda']))
      }))
      .filter((item) => item.platform);
  }

  private parseMovementBoolean(value: string | null): boolean {
    const text = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    return (
      text === 'si' ||
      text.startsWith('si,') ||
      text.startsWith('si ') ||
      text === 'yes' ||
      text.startsWith('yes ') ||
      text === 'true' ||
      text === '1'
    );
  }

  private parseCapitalEffect(value: string | null): InvestmentMovement['capitalEffect'] {
    const normalized = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

    if (!normalized) {
      return 'unknown';
    }

    if (normalized.includes('REDUCE') || normalized.includes('COSTO') || normalized.includes('COST')) {
      return 'reduces-cost';
    }

    return 'unknown';
  }

  private aggregateByCurrency(positions: PortfolioPosition[]): PortfolioSummary['byCurrency'] {
    const bucket = new Map<CanonicalCurrency, PortfolioPosition[]>();
    for (const position of positions) {
      const currency = this.currencyMapper.normalizeCurrency(position.currency);
      const list = bucket.get(currency) ?? [];
      list.push(position);
      bucket.set(currency, list);
    }

    return Array.from(bucket.entries()).map(([currency, list]) => {
      const totalCurrentValue = list.reduce((sum, position) => sum + position.currentValue, 0);
      const totalInvested = list.reduce((sum, position) => sum + position.totalInvested, 0);
      const totalResult = totalCurrentValue - totalInvested;
      return {
        currency,
        totalCurrentValue,
        totalInvested,
        totalResult,
        totalResultPercent: totalInvested > 0 ? (totalResult / totalInvested) * 100 : null,
        speciesCount: new Set(list.map((position) => position.symbol)).size
      };
    });
  }
}

