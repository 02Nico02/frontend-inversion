import { Injectable } from '@angular/core';
import { TableExpectation } from '../models/workbook.models';

@Injectable({ providedIn: 'root' })
export class WorkbookMappingService {
  readonly expectations: TableExpectation[] = [
    {
      key: 'operations',
      primaryName: 'Tabla6',
      aliases: ['Tabla6'],
      critical: true,
      expectedColumns: ['ID', 'Fecha', 'ESPECIE', 'MONEDA', 'CANT.', 'PREC. COMP.', 'TOTAL', 'PREC. ACT.', 'VALORI. ACT.', 'VARIACIÃ“N', 'Var_cuenta_rem_%', 'Valor_cuenta_rem', 'Monto', 'TEM', 'TNA', 'TOP', 'TENDENCIA']
    },
    {
      key: 'investmentMovements',
      primaryName: 'TablaMovimientosInversiones',
      aliases: ['TablaMovimientosInversiones'],
      critical: false,
      expectedColumns: ['Fecha', 'Especie', 'Tipo movimiento', 'Monto', 'Afecta rendimiento', 'Afecta capital invertido', 'Observación']
    },
    {
      key: 'positions',
      primaryName: 'TablaPosiciones',
      aliases: ['TablaPosiciones'],
      critical: true,
      expectedColumns: ['ESPECIE', 'MONEDA', 'TIPO', 'CANTIDAD', 'TOTAL INV', 'PRECIO ACT', 'TOTAL ACTUAL', 'RESULTADO $', 'RESULTADO %', 'PRECIO PROM']
    },
    {
      key: 'history',
      primaryName: 'Tabla5',
      aliases: ['Tabla5'],
      critical: true,
      expectedColumns: ['FECHA', 'MES', 'ESPECIE', 'PRECIO']
    },
    {
      key: 'dailyBalance',
      primaryName: 'Tabla14',
      aliases: ['Tabla14'],
      critical: true,
      expectedColumns: ['FECHA', 'MES', 'BALANCE']
    },
    {
      key: 'calendarBenchmark',
      primaryName: 'TablaCalendario',
      aliases: ['TablaCalendario'],
      critical: false,
      expectedColumns: ['Fecha', 'TNA', 'Rend_diaria', 'Indice']
    },
    {
      key: 'calendarBenchmarkRem',
      primaryName: 'TablaCalendarioRem',
      aliases: ['TablaCalendarioRem'],
      critical: false,
      expectedColumns: ['Fecha', 'TNA', 'Rend_diaria', 'Indice']
    },
    {
      key: 'calendarInflation',
      primaryName: 'TablaCalendarioInf',
      aliases: ['TablaCalendarioInf'],
      critical: false,
      expectedColumns: ['Fecha', 'Mes', 'Inflación mensual', 'Días del mes', 'Rend_diaria_inf', 'Indice_inf']
    },
    {
      key: 'classification',
      primaryName: 'Tabla47',
      aliases: ['Tabla47'],
      critical: false,
      expectedColumns: ['ESPECIE', 'VALORI. ACT.', 'Monto', 'Esperado', 'TIPO', 'SECTOR', 'SUBSECTOR', 'REGION']
    },
    {
      key: 'manualAlerts',
      primaryName: 'ObjetivosPorEspecie',
      aliases: ['ObjetivosPorEspecie'],
      critical: false,
      expectedColumns: ['Especie', 'CondiciÃ³n', 'Precio objetivo', 'Notas', 'Estado']
    },
    {
      key: 'alertsHigh',
      primaryName: 'AlertasSuperoElMaximo',
      aliases: ['AlertasSuperoElMaximo'],
      critical: false,
      expectedColumns: ['Especie', 'Fecha', 'PrecioActual', 'Objetivo', 'Alerta']
    },
    {
      key: 'alertsLow',
      primaryName: 'AlertasDebajoDelMinimo',
      aliases: ['AlertasDebajoDelMinimo'],
      critical: false,
      expectedColumns: ['Especie', 'Fecha', 'PrecioActual', 'Objetivo', 'Alerta']
    },
    {
      key: 'signalsDown5',
      primaryName: 'AlertasEspeciesEnCaida_5D',
      aliases: ['AlertasEspeciesEnCaida_5D', 'EspeciesEnCaida_5D'],
      critical: false,
      expectedColumns: ['ESPECIE', 'Fecha Inicio', 'Precio Inicio', 'Fecha Fin', 'Precio Fin', 'VariaciÃ³n %']
    },
    {
      key: 'signalsUp5',
      primaryName: 'EspeciesEnRecuperacion_5D',
      aliases: ['EspeciesEnRecuperacion_5D'],
      critical: false,
      expectedColumns: ['ESPECIE', 'Fecha Inicio', 'Precio Inicio', 'Fecha Fin', 'Precio Fin', 'VariaciÃ³n %']
    },
    {
      key: 'signalsDown30',
      primaryName: 'EspeciesEnCaida_30D',
      aliases: ['EspeciesEnCaida_30D'],
      critical: false,
      expectedColumns: ['ESPECIE', 'Fecha Inicio', 'Precio Inicio', 'Fecha Fin', 'Precio Fin', 'VariaciÃ³n %']
    },
    {
      key: 'signalsUp30',
      primaryName: 'EspeciesEnRecuperacion_30D',
      aliases: ['EspeciesEnRecuperacion_30D'],
      critical: false,
      expectedColumns: ['ESPECIE', 'Fecha Inicio', 'Precio Inicio', 'Fecha Fin', 'Precio Fin', 'VariaciÃ³n %']
    },
    {
      key: 'monthlySummary',
      primaryName: 'HistorialMensualReconstruido',
      aliases: ['HistorialMensualReconstruido'],
      critical: false,
      expectedColumns: ['MES', 'ValInicio', 'Compras', 'Ventas', 'ValFin', 'Resultado', 'VARIACIÃ“N %', 'InflaciÃ³n %', 'Rend. Real %', 'ColAux', 'Rend. Real Acum %', 'Ratio Aporte', 'Buen Mercado', 'Buen Aporte', 'Tipo de Mes', 'AÃ±o']
    },
    {
      key: 'annualSummary',
      primaryName: 'Tabla60',
      aliases: ['Tabla60'],
      critical: false,
      expectedColumns: ['AÃ±o', 'Val Inicio', 'Compras', 'Ventas', 'Val Fin', 'Resultado', 'Rend. %', 'InflaciÃ³n', 'Rend. Real', 'Ratio Aporte']
    },
    {
      key: 'monthlyPerformance',
      primaryName: 'Tabla9',
      aliases: ['Tabla9'],
      critical: false,
      expectedColumns: ['MES', 'TOTAL DEL MES', 'ACUMULADO', 'Val. Inicio', 'VARIACIÃ“N %', 'REND. REAL']
    },
    {
      key: 'strategicSplit',
      primaryName: 'Tabla35',
      aliases: ['Tabla35'],
      critical: false,
      expectedColumns: ['FECHA', 'VALOR AR', 'VALOR USD', '% JUBILACIÃ“N', '% AHORRO', 'MONTO JUB. AR', 'MONTO JUB. USD', 'MONTO AHOR. AR', 'MONTO AHOR. USD']
    },
    {
      key: 'platforms',
      primaryName: 'Tabla38',
      aliases: ['Tabla38'],
      critical: false,
      expectedColumns: ['Plataforma', 'Monto', 'moneda']
    },
    {
      key: 'cashflow',
      primaryName: 'Tabla39',
      aliases: ['Tabla39'],
      critical: false,
      expectedColumns: ['CUATRIMESTRE', 'AÃ‘O', 'INGRESO', 'EGRESO', 'BALANCE']
    }
  ];
}
