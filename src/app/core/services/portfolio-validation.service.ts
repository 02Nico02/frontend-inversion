import { Injectable } from '@angular/core';
import { AssetClassification, HistoricalPrice, InvestmentOperation, ManualAlert, PortfolioDataset, PortfolioPosition } from '../models/portfolio.models';
import { WorkbookValidationReport } from '../models/workbook.models';
import { DataNormalizationService } from './data-normalization.service';

@Injectable({ providedIn: 'root' })
export class PortfolioValidationService {
  constructor(private readonly normalization: DataNormalizationService) {}

  validateDataset(report: WorkbookValidationReport, dataset: PortfolioDataset): WorkbookValidationReport {
    const positions = dataset.positions;
    const historySymbols = new Set(dataset.historicalPrices.map((price) => price.symbol.toUpperCase()).filter(Boolean));
    const classificationSymbols = new Set(dataset.classifications.map((item) => item.symbol.toUpperCase()).filter(Boolean));
    const operationSymbols = new Set(dataset.operations.map((item) => item.symbol.toUpperCase()).filter(Boolean));
    const currentPriceBySymbol = new Map(positions.map((position) => [position.symbol.toUpperCase(), position.currentPrice]));

    const symbolsWithoutClassification = Array.from(operationSymbols).filter((symbol) => !classificationSymbols.has(symbol));
    const symbolsWithoutHistory = Array.from(positions.map((position) => position.symbol.toUpperCase())).filter((symbol) => !historySymbols.has(symbol));
    const symbolsWithoutCurrentPrice = dataset.manualAlerts
      .map((alert) => alert.symbol.toUpperCase())
      .filter((symbol) => {
        const currentPrice = currentPriceBySymbol.get(symbol);
        return currentPrice === null || currentPrice === undefined;
      });

    return {
      ...report,
      uncategorizedSymbols: Array.from(new Set([...report.uncategorizedSymbols, ...symbolsWithoutClassification])),
      symbolsWithoutHistory: Array.from(new Set([...report.symbolsWithoutHistory, ...symbolsWithoutHistory])),
      symbolsWithoutCurrentPrice: Array.from(new Set([...report.symbolsWithoutCurrentPrice, ...symbolsWithoutCurrentPrice]))
    };
  }
}
