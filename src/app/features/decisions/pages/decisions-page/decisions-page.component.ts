import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';
import { DecisionInsightsService } from '../../services/decision-insights.service';
import { ExportFormat, ExportCurrencyScope, ExportMode, ExportSimulationCurrency, GptPortfolioExportOptions, GptPortfolioExportService } from '../../services/gpt-portfolio-export.service';
import { FileDownloadService } from '../../../../core/services/file-download.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './decisions-page.component.html',
  styleUrls: ['./decisions-page.component.scss']
})
export class DecisionsPageComponent {
  currencyScope: ExportCurrencyScope = 'ALL';
  simulationCurrency: ExportSimulationCurrency = 'ARS';
  exportMode: ExportMode = 'summary';
  monthlyContribution = 100000;
  months = 12;
  annualReturnPercent = 15;
  exportFormat: ExportFormat = 'markdown';
  includeFullPurchases = true;
  includeMonthlyHistory = true;
  includeSignals = true;
  includeDataReview = true;
  includeSimulation = true;
  maskSensitiveExports = false;

  constructor(
    public readonly state: PortfolioStateService,
    public readonly privacyMode: PrivacyModeService,
    private readonly insights: DecisionInsightsService,
    private readonly exporter: GptPortfolioExportService,
    private readonly downloader: FileDownloadService
  ) {}

  model(snapshot: PortfolioAppState) {
    return this.insights.build(snapshot, this.currencyScope, this.simulationCurrency, this.monthlyContribution, this.months, this.annualReturnPercent);
  }

  trackByItem(index: number, item: { label?: unknown; symbol?: unknown; title?: unknown }): string {
    return String(item.label ?? item.symbol ?? item.title ?? index);
  }

  exportContext(snapshot: PortfolioAppState): void {
    const options = this.exportOptions();
    if (this.privacyMode.enabled && !this.maskSensitiveExports) {
      const confirmed = window.confirm('El modo privacidad esta activo. El archivo exportado puede contener datos sensibles reales. Deseas continuar?');
      if (!confirmed) {
        return;
      }
    }

    const viewModel = this.model(snapshot);
    const result = this.exporter.buildExport(snapshot, viewModel, options);
    const baseName = `contexto-portafolio-${this.today()}`;

    if (options.format !== 'json' && result.markdown) {
      this.downloader.downloadText(`${baseName}.md`, result.markdown, 'text/markdown;charset=utf-8');
    }
    if (options.format !== 'markdown' && result.json) {
      this.downloader.downloadText(`${baseName}.json`, result.json, 'application/json;charset=utf-8');
    }
  }

  async copySummary(snapshot: PortfolioAppState): Promise<void> {
    const text = this.exporter.buildClipboardSummary(snapshot, this.model(snapshot), this.exportOptions());
    await this.downloader.copyText(text);
  }

  exportOptions(): GptPortfolioExportOptions {
    return {
      format: this.exportFormat,
      mode: this.exportMode,
      includeFullPurchases: this.includeFullPurchases,
      includeMonthlyHistory: this.includeMonthlyHistory,
      includeSignals: this.includeSignals,
      includeDataReview: this.includeDataReview,
      includeSimulation: this.includeSimulation,
      maskSensitive: this.maskSensitiveExports,
      currencyScope: this.currencyScope,
      simulationCurrency: this.simulationCurrency
    };
  }

  private today(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
