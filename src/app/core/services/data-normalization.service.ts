import { Injectable } from '@angular/core';
import { CurrencyMapperService, CanonicalCurrency } from './currency-mapper.service';
import { normalizeText } from '../utils/excel.utils';
import { parseExcelDate, parseLocaleNumber, parsePercentageValue, toIsoDate } from '../utils/value-parsing.utils';

export interface ColumnAliasMap {
  [normalizedName: string]: string[];
}

@Injectable({ providedIn: 'root' })
export class DataNormalizationService {
  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  readonly columnAliases: ColumnAliasMap = {
    id: ['ID'],
    date: ['FECHA', 'DATE', 'FECHA COMP.', 'FECHA VENT.', 'FECHA CAMBIO', 'FECHA INICIO', 'FECHA FIN'],
    month: ['MES', 'AÑOMES', 'ANOMES'],
    symbol: ['ESPECIE', 'EPECIE', 'SYMBOl', 'SYMBOL', 'SÍMBOLO', 'SIMBOLO', 'COMPRA'],
    currency: ['MONEDA', 'CURRENCY'],
    quantity: ['CANT.', 'CANTIDAD', 'QUANTITY'],
    buyPrice: ['PREC. COMP.', 'PRECIO COMPRA', 'BUY PRICE', 'PREC. EN V.'],
    total: ['TOTAL', 'TOTAL INV', 'TOTAL INV.', 'VALOR'],
    currentPrice: ['PREC. ACT.', 'PRECIO ACT', 'PRECIO ACTUAL', 'CURRENT PRICE', 'PRECIOACT'],
    currentValue: ['VALORI. ACT.', 'VALOR ACTUAL', 'TOTAL ACTUAL', 'CURRENT VALUE'],
    variation: ['VARIACIÓN', 'VARIACION', 'RESULTADO %', 'VARIACION %'],
    remVariation: ['VAR_CUENTA_REM_%', 'VAR CUENTA REM %'],
    remValue: ['VALOR_CUENTA_REM', 'VALOR CUENTA REM'],
    amount: ['MONTO', 'AMOUNT'],
    monthlyRate: ['TEM'],
    annualRate: ['TNA', 'RENDIMIENTO ANUAL'],
    top: ['TOP'],
    trend: ['TENDENCIA'],
    type: ['TIPO'],
    sector: ['SECTOR'],
    subsector: ['SUBSECTOR', 'SUB CAT.'],
    region: ['REGION', 'PAIS', 'COUNTRY'],
    expected: ['ESPERADO', 'OBJETIVO'],
    condition: ['CONDICIÓN', 'CONDICION'],
    targetPrice: ['PRECIO OBJETIVO', 'OBJETIVO'],
    notes: ['NOTAS', 'NOTA'],
    status: ['ESTADO'],
    alert: ['ALERTA'],
    platform: ['PLATAFORMA'],
    amountCurrency: ['MONEDA'],
    retirementPercent: ['% JUBILACIÓN', '% JUBILACION'],
    savingsPercent: ['% AHORRO'],
    valueARS: ['VALOR AR'],
    valueUSD: ['VALOR USD'],
    retirementAmountARS: ['MONTO JUB. AR'],
    retirementAmountUSD: ['MONTO JUB. USD'],
    savingsAmountARS: ['MONTO AHOR. AR'],
    savingsAmountUSD: ['MONTO AHOR. USD'],
    startValue: ['VAL INICIO', 'VALOR INICIAL'],
    purchases: ['COMPRAS'],
    sales: ['VENTAS'],
    endValue: ['VAL FIN'],
    result: ['RESULTADO'],
    variationPercent: ['VARIACIÓN %', 'VARIACION %', 'REND. %'],
    inflationPercent: ['INFLACIÓN %', 'INFLACION %', 'INFLACIÓN', 'INFLACION'],
    realReturnPercent: ['REND. REAL %', 'REND. REAL'],
    accumulatedRealReturnPercent: ['REND. REAL ACUM %', 'REND. REAL ACUMULADO %'],
    contributionRatio: ['RATIO APORTE'],
    goodMarket: ['BUEN MERCADO'],
    goodContribution: ['BUEN APORTE'],
    monthType: ['TIPO DE MES'],
    year: ['AÑO', 'ANO'],
    balance: ['BALANCE'],
    price: ['PRECIO'],
    startDate: ['FECHA INICIO'],
    endDate: ['FECHA FIN'],
    startPrice: ['PRECIO INICIO'],
    endPrice: ['PRECIO FIN'],
    stringMonth: ['MES']
  };

  normalizeHeader(value: unknown): string {
    return normalizeText(value).replace(/\./g, '').replace(/\s+/g, ' ');
  }

  pickValue<T = unknown>(row: Record<string, unknown>, aliases: string[]): T | null {
    const lookup = new Map<string, unknown>();
    for (const [key, value] of Object.entries(row)) {
      lookup.set(this.normalizeHeader(key), value);
    }
    for (const alias of aliases) {
      const found = lookup.get(this.normalizeHeader(alias));
      if (found !== undefined) {
        return found as T;
      }
    }
    return null;
  }

  asText(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return String(value).trim();
  }

  asNumber(value: unknown): number | null {
    return parseLocaleNumber(value);
  }

  asDate(value: unknown): Date | null {
    return parseExcelDate(value);
  }

  asIsoDate(value: unknown): string | null {
    return toIsoDate(value);
  }

  asPercent(value: unknown): number | null {
    return parsePercentageValue(value);
  }

  normalizeCurrency(value: unknown): string | null {
    const normalized = this.currencyMapper.normalizeCurrency(value);
    return normalized === 'UNKNOWN' ? null : normalized;
  }

  normalizeCurrencyOrUnknown(value: unknown): CanonicalCurrency {
    return this.currencyMapper.normalizeCurrency(value);
  }

  normalizeSymbol(value: unknown): string | null {
    const text = this.asText(value);
    return text ? text.toUpperCase() : null;
  }
}
