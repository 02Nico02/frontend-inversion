import { Injectable } from '@angular/core';
import { AssetClassification, DailyBalance, HistoricalPrice, ManualAlert, MarketSignal, PortfolioDataset, PortfolioPosition, StrategicSplit } from '../models/portfolio.models';
import { DataHealthSummary, DataReviewFinding, DataReviewReport } from '../models/analysis.models';
import { WorkbookValidationReport } from '../models/workbook.models';

@Injectable({ providedIn: 'root' })
export class PortfolioHealthService {
  buildReport(dataset: PortfolioDataset, validation: WorkbookValidationReport): DataReviewReport {
    const positions = dataset.positions ?? [];
    const classifications = dataset.classifications ?? [];
    const histories = dataset.historicalPrices ?? [];
    const alerts = dataset.manualAlerts ?? [];
    const signals = dataset.signals ?? [];
    const strategicSplit = dataset.strategicSplit ?? [];

    const classificationBySymbol = new Map(classifications.map((item) => [item.symbol.toUpperCase(), item]));
    const historySymbols = new Set(histories.map((item) => item.symbol.toUpperCase()));
    const positionSymbols = new Set(positions.map((item) => item.symbol.toUpperCase()));
    const findings: DataReviewFinding[] = [];

    for (const position of positions) {
      const symbol = position.symbol.toUpperCase();
      const classification = classificationBySymbol.get(symbol) ?? null;
      if (!classification) {
        findings.push(this.finding('clasificación', 'critical', position, 'No existe clasificación para esta especie', 'Tabla47', 'Agregarla a Tabla47 para habilitar los gráficos y filtros por tipo, sector y región.'));
      } else {
        const missing = this.missingClassificationParts(classification);
        if (missing.length) {
          findings.push(this.finding('clasificación', 'warning', position, `Clasificación parcial: falta ${missing.join(', ')}`, 'Tabla47', 'Completar los campos faltantes para esta especie en Tabla47.'));
        }
      }

      if (!historySymbols.has(symbol)) {
        findings.push(this.finding('histórico', 'warning', position, 'No tiene precios históricos en Tabla5', 'Tabla5', 'Revisar si la especie quedó afuera del histórico o si el ticker cambió.'));
      }
    }

    const manualAlerts = this.reviewManualAlerts(alerts, positions);
    const signalFindings = this.reviewSignals(signals, positions);
    const strategicFindings = this.reviewStrategicSplit(strategicSplit, positions);
    const workbookFindings = this.reviewWorkbookWarnings(validation, positions, histories, alerts);

    findings.push(...manualAlerts, ...signalFindings, ...strategicFindings, ...workbookFindings);

    const summary: DataHealthSummary = {
      criticalProblems: findings.filter((item) => item.severity === 'critical').length,
      warnings: findings.filter((item) => item.severity === 'warning').length,
      uncategorizedAssets: new Set(findings.filter((item) => item.category === 'clasificación').map((item) => item.symbol).filter(Boolean) as string[]).size,
      assetsWithoutHistory: new Set(findings.filter((item) => item.category === 'histórico').map((item) => item.symbol).filter(Boolean) as string[]).size,
      alertsToReview: new Set(findings.filter((item) => item.category === 'alertas').map((item) => `${item.symbol ?? ''}|${item.problem}`)).size,
      incompleteSignals: new Set(findings.filter((item) => item.category === 'señales').map((item) => `${item.symbol ?? ''}|${item.problem}`)).size,
      strategicSplitIssues: findings.filter((item) => item.category === 'split').length,
      status: findings.some((item) => item.severity === 'critical') ? 'critical' : findings.some((item) => item.severity === 'warning') ? 'warning' : 'ok'
    };

    return { summary, findings };
  }

  private reviewWorkbookWarnings(validation: WorkbookValidationReport, positions: PortfolioPosition[], histories: HistoricalPrice[], alerts: ManualAlert[]): DataReviewFinding[] {
    const findings: DataReviewFinding[] = [];
    for (const currencyIssue of validation.currencyIssues ?? []) {
      findings.push({
        category: 'moneda',
        severity: 'warning',
        symbol: null,
        currency: currencyIssue.currency || null,
        currentValue: currencyIssue.count,
        problem: `Moneda poco clara o inválida: ${currencyIssue.currency}`,
        source: 'WorkbookValidation',
        suggestion: 'Normalizar la moneda a ARS o USD en el Excel.'
      });
    }
    for (const symbol of validation.symbolsWithoutHistory ?? []) {
      findings.push({
        category: 'histórico',
        severity: 'warning',
        symbol,
        currency: null,
        currentValue: null,
        problem: 'La validación detectó especie sin histórico',
        source: 'WorkbookValidation',
        suggestion: 'Agregar datos a Tabla5 o verificar el ticker.'
      });
    }
    for (const symbol of validation.symbolsWithoutCurrentPrice ?? []) {
      findings.push({
        category: 'alertas',
        severity: 'warning',
        symbol,
        currency: null,
        currentValue: null,
        problem: 'Alerta manual sin precio actual',
        source: 'WorkbookValidation',
        suggestion: 'Asegurar que la especie tenga precio actual en posiciones.'
      });
    }
    return findings;
  }

  private reviewManualAlerts(alerts: ManualAlert[], positions: PortfolioPosition[]): DataReviewFinding[] {
    const findings: DataReviewFinding[] = [];
    const positionBySymbol = new Set(positions.map((item) => item.symbol.toUpperCase()));
    const duplicateCount = new Map<string, number>();
    for (const alert of alerts) {
      const key = `${alert.symbol.toUpperCase()}|${alert.condition ?? ''}|${alert.targetPrice ?? ''}|${alert.notes ?? ''}|${alert.status ?? ''}`;
      duplicateCount.set(key, (duplicateCount.get(key) ?? 0) + 1);
      if (!positionBySymbol.has(alert.symbol.toUpperCase())) {
        findings.push({
          category: 'alertas',
          severity: 'warning',
          symbol: alert.symbol,
          currency: null,
          currentValue: null,
          problem: 'Alerta manual para una especie que no está en posiciones',
          source: 'ObjetivosPorEspecie',
          suggestion: 'Revisar si el ticker cambió o si la posición fue removida.'
        });
      }
      if (alert.targetPrice === null || alert.targetPrice === undefined || alert.targetPrice <= 0) {
        findings.push({
          category: 'alertas',
          severity: 'warning',
          symbol: alert.symbol,
          currency: null,
          currentValue: alert.targetPrice ?? null,
          problem: 'Precio objetivo inválido o vacío',
          source: 'ObjetivosPorEspecie',
          suggestion: 'Definir un precio objetivo mayor que cero.'
        });
      }
      if (!String(alert.status ?? '').trim()) {
        findings.push({
          category: 'alertas',
          severity: 'warning',
          symbol: alert.symbol,
          currency: null,
          currentValue: null,
          problem: 'Alerta manual sin estado',
          source: 'ObjetivosPorEspecie',
          suggestion: 'Completar el estado para saber si la alerta está activa o pendiente.'
        });
      }
    }
    for (const [key, count] of duplicateCount.entries()) {
      if (count > 1) {
        const [symbol] = key.split('|');
        findings.push({
          category: 'alertas',
          severity: 'info',
          symbol,
          currency: null,
          currentValue: count,
          problem: 'Alerta duplicada exacta',
          source: 'ObjetivosPorEspecie',
          suggestion: 'Consolidar duplicados para evitar ruido en el drawer.'
        });
      }
    }
    return findings;
  }

  private reviewSignals(signals: MarketSignal[], positions: PortfolioPosition[]): DataReviewFinding[] {
    const findings: DataReviewFinding[] = [];
    const positionBySymbol = new Set(positions.map((item) => item.symbol.toUpperCase()));
    for (const signal of signals) {
      if (!positionBySymbol.has(signal.symbol.toUpperCase())) {
        findings.push({
          category: 'señales',
          severity: 'warning',
          symbol: signal.symbol,
          currency: null,
          currentValue: null,
          problem: 'Señal para una especie que no existe en posiciones',
          source: signal.period,
          suggestion: 'Revisar si el ticker cambió o si la posición ya no está activa.'
        });
      }
      if (!signal.startDate || !signal.endDate || signal.startPrice === null || signal.endPrice === null || signal.variationPercent === null) {
        findings.push({
          category: 'señales',
          severity: 'warning',
          symbol: signal.symbol,
          currency: null,
          currentValue: null,
          problem: 'Señal con datos incompletos',
          source: signal.period,
          suggestion: 'Completar fechas, precios y variación en la tabla de señales.'
        });
      }
    }
    return findings;
  }

  private reviewStrategicSplit(strategicSplit: StrategicSplit[], positions: PortfolioPosition[]): DataReviewFinding[] {
    const findings: DataReviewFinding[] = [];
    if (!strategicSplit.length) {
      return findings;
    }
    const totalPortfolio = positions.reduce((sum, position) => sum + position.currentValue, 0);
    const maxValueARS = Math.max(...strategicSplit.map((item) => Number(item.valueARS ?? 0)));
    const maxValueUSD = Math.max(...strategicSplit.map((item) => Number(item.valueUSD ?? 0)));
    for (const row of strategicSplit) {
      if (!row.date) {
        findings.push({
          category: 'split',
          severity: 'warning',
          symbol: null,
          currency: null,
          currentValue: null,
          problem: 'Fila de split sin fecha',
          source: 'Tabla35',
          suggestion: 'Completar la fecha para mantener orden temporal.'
        });
      }
      if ([row.retirementPercent, row.savingsPercent].some((value) => value === null || value === undefined || value < 0 || value > 100)) {
        findings.push({
          category: 'split',
          severity: 'warning',
          symbol: null,
          currency: null,
          currentValue: null,
          problem: 'Porcentajes fuera de rango en split estratégico',
          source: 'Tabla35',
          suggestion: 'Verificar que % Jubilación y % Ahorro estén entre 0 y 100.'
        });
      }
    }
    if (totalPortfolio > 0 && maxValueARS > 0 && maxValueARS < totalPortfolio * 0.02 && maxValueUSD <= totalPortfolio * 0.02) {
      findings.push({
        category: 'split',
        severity: 'warning',
        symbol: null,
        currency: null,
        currentValue: Math.max(maxValueARS, maxValueUSD),
        problem: 'La escala de Tabla35 requiere revisión',
        source: 'Tabla35',
        suggestion: 'Se detectaron montos muy bajos frente al total del portafolio; revisar si los valores están en otra escala.'
      });
    }
    return findings;
  }

  private missingClassificationParts(classification: AssetClassification): string[] {
    const missing: string[] = [];
    if (!classification.type) missing.push('tipo');
    if (!classification.sector) missing.push('sector');
    if (!classification.subsector) missing.push('subsector');
    if (!classification.region) missing.push('región');
    return missing;
  }

  private finding(category: string, severity: 'info' | 'warning' | 'critical', position: PortfolioPosition, problem: string, source: string, suggestion: string): DataReviewFinding {
    return {
      category,
      severity,
      symbol: position.symbol,
      currency: position.currency,
      currentValue: position.currentValue,
      problem,
      source,
      suggestion
    };
  }
}
