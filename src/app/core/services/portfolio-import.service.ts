import { Injectable } from '@angular/core';
import { ExcelImportService } from './excel-import.service';
import { PortfolioCalculatorService } from './portfolio-calculator.service';
import { PortfolioStateService } from './portfolio-state.service';
import { PortfolioValidationService } from './portfolio-validation.service';
import { AlertMapperService } from './alert-mapper.service';
import { ChartDataService } from './chart-data.service';

@Injectable({ providedIn: 'root' })
export class PortfolioImportService {
  constructor(
    private readonly excelImport: ExcelImportService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly portfolioState: PortfolioStateService,
    private readonly chartData: ChartDataService,
    private readonly alertMapper: AlertMapperService,
    private readonly validationService: PortfolioValidationService
  ) {}

  async importFile(file: File): Promise<boolean> {
    this.portfolioState.setLoading(file.name);
    try {
      const workbook = await this.excelImport.importWorkbook(file);
      const dataset = this.calculator.buildDataset(workbook.tables);
      const summary = this.calculator.buildSummary(dataset);
      const validation = this.validationService.validateDataset(workbook.validation, dataset);
      const alerts = [
        ...this.alertMapper.combine(dataset.manualAlerts, dataset.calculatedAlerts, dataset.positions),
        ...this.alertMapper.buildSignals(dataset.signals)
      ];
      const enrichedPositions = this.calculator.enrichPositions(dataset.positions, dataset.classifications);
      const status = validation.errors.length ? 'warning' : 'ready';

      this.portfolioState.setReady({
        status,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        workbook: {
          ...workbook,
          validation
        },
        dataset,
        summary,
        combinedAlerts: alerts,
        charts: {
          symbolDistribution: this.chartData.distributionBySymbol(enrichedPositions),
          currencyDistribution: this.chartData.distributionByCurrency(enrichedPositions),
          positionTypeDistribution: this.chartData.distributionByPositionType(enrichedPositions),
          assetTypeDistribution: this.chartData.distributionByAssetType(enrichedPositions),
          sectorDistribution: this.chartData.distributionBySector(enrichedPositions),
          subsectorDistribution: this.chartData.distributionBySubsector(enrichedPositions),
          regionDistribution: this.chartData.distributionByRegion(enrichedPositions),
          balanceSeries: this.chartData.balanceSeries(dataset.dailyBalances),
          priceSeries: []
        },
        validationErrors: validation.errors,
        validationWarnings: validation.warnings
      });
      return true;
    } catch (error) {
      this.portfolioState.setError(error instanceof Error ? error.message : 'No se pudo importar el workbook');
      return false;
    }
  }
}
