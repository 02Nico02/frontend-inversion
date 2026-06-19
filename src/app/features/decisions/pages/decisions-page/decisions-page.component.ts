import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';
import { DecisionActivatedAlertsComponent } from '../../components/decision-activated-alerts/decision-activated-alerts.component';
import { DecisionExportPanelComponent } from '../../components/decision-export-panel/decision-export-panel.component';
import { DecisionLiquidityPanelComponent } from '../../components/decision-liquidity-panel/decision-liquidity-panel.component';
import { DecisionMinimumBenchmarkReviewComponent } from '../../components/decision-minimum-benchmark-review/decision-minimum-benchmark-review.component';
import { DecisionMovementsPanelComponent } from '../../components/decision-movements-panel/decision-movements-panel.component';
import { DecisionPerformancePanelComponent } from '../../components/decision-performance-panel/decision-performance-panel.component';
import { DecisionSignalsSummaryComponent } from '../../components/decision-signals-summary/decision-signals-summary.component';
import { DecisionSimulatorPanelComponent } from '../../components/decision-simulator-panel/decision-simulator-panel.component';
import { DecisionSummaryPanelComponent } from '../../components/decision-summary-panel/decision-summary-panel.component';
import { DecisionDashboardService, SimulationRateMode } from '../../services/decision-dashboard.service';
import { DecisionInsightsService } from '../../services/decision-insights.service';
import { DecisionOpportunitiesService } from '../../services/decision-opportunities.service';
import { ExportCurrencyScope, ExportFormat, ExportMode, ExportSimulationCurrency, GptPortfolioExportOptions, GptPortfolioExportService, WeeklyManualContext } from '../../services/gpt-portfolio-export.service';
import { MovementDateRange, MovementDateRangeService, MovementRangePreset } from '../../services/movement-date-range.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    DecisionSummaryPanelComponent,
    DecisionLiquidityPanelComponent,
    DecisionMovementsPanelComponent,
    DecisionMinimumBenchmarkReviewComponent,
    DecisionActivatedAlertsComponent,
    DecisionSimulatorPanelComponent,
    DecisionPerformancePanelComponent,
    DecisionExportPanelComponent,
    DecisionSignalsSummaryComponent
  ],
  templateUrl: './decisions-page.component.html',
  styleUrls: ['./decisions-page.component.scss']
})
export class DecisionsPageComponent implements OnInit, OnDestroy {
  readonly weeklyContextStorageKey = 'frontend-inversion.weekly-export-context';
  readonly movementDateRangeStorageKey = 'frontend-inversion.movement-date-range';
  readonly movementPresets: Array<{ preset: MovementRangePreset; label: string }> = [
    { preset: '7d', label: 'Últimos 7 días' },
    { preset: '15d', label: 'Últimos 15 días' },
    { preset: '30d', label: 'Últimos 30 días' },
    { preset: 'currentMonth', label: 'Mes actual' },
    { preset: 'custom', label: 'Personalizado' }
  ];

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
  movementDateRange: MovementDateRange = { from: null, to: null, preset: '7d' };
  weeklyContext: WeeklyManualContext = this.loadWeeklyContext();

  private readonly subscription = new Subscription();
  private lastSnapshotKey = '';

  constructor(
    public readonly state: PortfolioStateService,
    public readonly privacyMode: PrivacyModeService,
    private readonly insights: DecisionInsightsService,
    private readonly dashboard: DecisionDashboardService,
    private readonly opportunities: DecisionOpportunitiesService,
    private readonly movementDateRangeService: MovementDateRangeService,
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
    this.ensureMovementRange(snapshot);

    const base = this.insights.build(snapshot, this.currencyScope, this.simulationCurrency, this.monthlyContribution, this.months, this.annualReturnPercent);
    const extras = this.dashboard.build(
      snapshot,
      this.weeklyContext,
      this.movementDateRange,
      this.currencyScope,
      this.simulationCurrency,
      this.monthlyContribution,
      this.months,
      this.simulationRateMode,
      this.annualReturnPercent
    );
    const opportunities = this.opportunities.build(snapshot);

    this.vm = {
      ...base,
      ...extras,
      ...opportunities
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
      const confirmed = window.confirm('El modo privacidad está activo. El archivo exportado puede contener datos sensibles reales. ¿Deseas continuar?');
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
      movementDateRange: this.movementDateRange,
      manualContext: this.weeklyContext
    };
  }

  setMovementPreset(preset: MovementRangePreset): void {
    const snapshot = this.state.snapshot;
    const currentTo = this.movementDateRange.to ?? this.movementDateRangeService.latestAvailableDate(snapshot);
    this.movementDateRange = this.movementDateRangeService.applyMovementPreset(preset, currentTo);
    this.persistMovementRange();
    this.refreshVm();
  }

  onMovementDateChange(field: 'from' | 'to', value: string | null): void {
    this.movementDateRange = {
      ...this.movementDateRange,
      [field]: value || null,
      preset: 'custom'
    };
    this.persistMovementRange();
    this.refreshVm();
  }

  persistWeeklyContext(): void {
    try {
      localStorage.setItem(this.weeklyContextStorageKey, JSON.stringify(this.weeklyContext));
    } catch {
      // Ignore storage errors in private mode or restricted browsers.
    }
  }

  private ensureMovementRange(snapshot: PortfolioAppState): void {
    const snapshotKey = this.snapshotKey(snapshot);
    if (snapshotKey === this.lastSnapshotKey && this.movementDateRange.from && this.movementDateRange.to) {
      return;
    }

    const stored = this.loadMovementRange();
    const candidate = stored ?? this.movementDateRangeService.getDefaultMovementRange(snapshot);
    this.movementDateRange = this.movementDateRangeService.normalizeForSnapshot(candidate, snapshot);
    this.lastSnapshotKey = snapshotKey;
  }

  private loadMovementRange(): MovementDateRange | null {
    try {
      const raw = localStorage.getItem(this.movementDateRangeStorageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as MovementDateRange;
      return {
        from: typeof parsed?.from === 'string' ? parsed.from : null,
        to: typeof parsed?.to === 'string' ? parsed.to : null,
        preset: parsed?.preset ?? 'custom'
      };
    } catch {
      return null;
    }
  }

  persistMovementRange(): void {
    try {
      localStorage.setItem(this.movementDateRangeStorageKey, JSON.stringify(this.movementDateRange));
    } catch {
      // Ignore storage errors.
    }
  }

  private snapshotKey(snapshot: PortfolioAppState): string {
    return [
      snapshot.fileName ?? '',
      snapshot.importedAt ?? '',
      snapshot.status,
      snapshot.dataset?.operations.length ?? 0,
      snapshot.dataset?.sales.length ?? 0
    ].join('|');
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
