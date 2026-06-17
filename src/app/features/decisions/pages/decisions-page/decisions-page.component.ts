import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';
import { DecisionInsightsService } from '../../services/decision-insights.service';
import { ExportFormat, ExportCurrencyScope, ExportMode, ExportSimulationCurrency, GptPortfolioExportOptions, GptPortfolioExportService, WeeklyManualContext } from '../../services/gpt-portfolio-export.service';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { DecisionDashboardService, SimulationRateMode } from '../../services/decision-dashboard.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './decisions-page.component.html',
  styleUrls: ['./decisions-page.component.scss']
})
export class DecisionsPageComponent {
  readonly weeklyContextStorageKey = 'frontend-inversion.weekly-export-context';
  vm: any = null;
  currencyScope: ExportCurrencyScope = 'ALL';
  simulationCurrency: ExportSimulationCurrency = 'ARS';
  exportMode: ExportMode = 'summary';
  monthlyContribution = 100000;
  months = 12;
  annualReturnPercent = 15;
  simulationRateMode: SimulationRateMode = 'real12m';
  exportFormat: ExportFormat = 'markdown';
  includeFullPurchases = false;
  includeMonthlyHistory = true;
  includeSignals = true;
  includeDataReview = true;
  includeSimulation = false;
  maskSensitiveExports = false;
  movementsPeriodDays = 7;
  weeklyContext: WeeklyManualContext = this.loadWeeklyContext();
  private readonly subscription = new Subscription();

  constructor(
    public readonly state: PortfolioStateService,
    public readonly privacyMode: PrivacyModeService,
    private readonly insights: DecisionInsightsService,
    private readonly dashboard: DecisionDashboardService,
    private readonly exporter: GptPortfolioExportService,
    private readonly downloader: FileDownloadService
  ) {
    this.refreshVm();
  }

  ngOnInit(): void {
    this.subscription.add(
      this.state.state$.subscribe(() => {
        this.refreshVm();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  refreshVm(): void {
    const snapshot = this.state.snapshot;
    const base = this.insights.build(snapshot, this.currencyScope, this.simulationCurrency, this.monthlyContribution, this.months, this.annualReturnPercent);
    const extras = this.dashboard.build(
      snapshot,
      this.weeklyContext,
      this.movementsPeriodDays,
      this.currencyScope,
      this.simulationCurrency,
      this.monthlyContribution,
      this.months,
      this.simulationRateMode,
      this.annualReturnPercent
    );

    this.vm = {
      ...base,
      ...extras
    };
  }

  onControlsChange(): void {
    this.refreshVm();
  }

  trackByItem(index: number, item: any): string {
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

    const viewModel = this.insights.build(snapshot, this.currencyScope, this.simulationCurrency, this.monthlyContribution, this.months, this.annualReturnPercent);
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
    const text = this.exporter.buildClipboardSummary(snapshot, this.insights.build(snapshot, this.currencyScope, this.simulationCurrency, this.monthlyContribution, this.months, this.annualReturnPercent), this.exportOptions());
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
      simulationCurrency: this.simulationCurrency,
      movementsPeriodDays: this.movementsPeriodDays,
      manualContext: this.weeklyContext
    };
  }

  persistWeeklyContext(): void {
    try {
      localStorage.setItem(this.weeklyContextStorageKey, JSON.stringify(this.weeklyContext));
    } catch {
      // Ignore storage errors in private mode or restricted browsers.
    }
  }

  clearWeeklyContext(): void {
    this.weeklyContext = {
      cashArs: null,
      cashUsd: null
    };
    try {
      localStorage.removeItem(this.weeklyContextStorageKey);
    } catch {
      // Ignore storage errors.
    }
  }

  private today(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadWeeklyContext(): WeeklyManualContext {
    try {
      const raw = localStorage.getItem(this.weeklyContextStorageKey);
      if (!raw) {
        return {
          cashArs: null,
          cashUsd: null
        };
      }
      const parsed = JSON.parse(raw) as WeeklyManualContext;
      return {
        cashArs: typeof parsed?.cashArs === 'number' ? parsed.cashArs : null,
        cashUsd: typeof parsed?.cashUsd === 'number' ? parsed.cashUsd : null
      };
    } catch {
      return {
        cashArs: null,
        cashUsd: null
      };
    }
  }
}
