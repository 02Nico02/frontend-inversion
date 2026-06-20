import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DataReviewFinding, DataReviewReport, ReviewSeverity } from '../../../../core/models/analysis.models';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { PortfolioHealthService } from '../../../../core/services/portfolio-health.service';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';

type ReviewSeverityFilter = 'all' | ReviewSeverity;

interface DataReviewFilters {
  severity: ReviewSeverityFilter;
  source: string;
  symbol: string;
  text: string;
}

interface DataReviewSourceGroup {
  source: string;
  count: number;
}

interface DataReviewIssueView {
  severity: ReviewSeverity;
  severityLabel: string;
  source: string;
  symbol: string;
  problem: string;
  suggestion: string;
  currentValue: number | null;
  currency: string | null;
  currentValueLabel: string;
  actionLabel: string;
  actionLink: string | null;
  searchText: string;
}

interface DataReviewViewModel {
  hasWorkbook: boolean;
  totalIssues: number;
  filteredIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  sources: string[];
  symbols: string[];
  sourceGroups: DataReviewSourceGroup[];
  issues: DataReviewIssueView[];
  emptyMessage: string | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './data-review-page.component.html',
  styleUrls: ['./data-review-page.component.scss'],
})
export class DataReviewPageComponent implements OnInit, OnDestroy {
  readonly severityOptions: Array<{ value: ReviewSeverityFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'critical', label: 'Críticas' },
    { value: 'warning', label: 'Advertencias' },
    { value: 'info', label: 'Informativas' }
  ];

  filters: DataReviewFilters = {
    severity: 'all',
    source: 'all',
    symbol: 'all',
    text: ''
  };

  vm: DataReviewViewModel | null = null;

  private readonly subscription = new Subscription();

  constructor(
    public readonly state: PortfolioStateService,
    public readonly privacyMode: PrivacyModeService,
    private readonly healthService: PortfolioHealthService,
    private readonly currencyMapper: CurrencyMapperService
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

  onFiltersChange(): void {
    this.refreshVm();
  }

  clearFilters(): void {
    this.filters = {
      severity: 'all',
      source: 'all',
      symbol: 'all',
      text: ''
    };
    this.refreshVm();
  }

  trackByIssue(_index: number, issue: DataReviewIssueView): string {
    return `${issue.severity}:${issue.source}:${issue.symbol}:${issue.problem}`;
  }

  formatSource(value: string): string {
    return this.normalizeText(value);
  }

  formatText(value: string): string {
    return this.normalizeText(value);
  }

  formatValue(issue: DataReviewIssueView): string {
    if (issue.currentValue === null || issue.currentValue === undefined || Number.isNaN(issue.currentValue)) {
      return 'N/D';
    }
    if (issue.currency) {
      return this.currencyMapper.formatCurrency(issue.currentValue, issue.currency);
    }
    return this.currencyMapper.formatNumber(issue.currentValue);
  }

  private refreshVm(): void {
    const snapshot = this.state.snapshot;
    const hasWorkbook = snapshot.status === 'ready' && !!snapshot.dataset && !!snapshot.workbook;

    const report = hasWorkbook
      ? this.healthService.buildReport(snapshot.dataset!, snapshot.workbook!.validation)
      : this.emptyReport();

    const allIssues = report.findings.map((finding) => this.toIssueView(finding));
    const sources = this.uniqueSorted(allIssues.map((item) => item.source));
    const symbols = this.uniqueSorted(allIssues.map((item) => item.symbol).filter(Boolean));
    const filteredIssues = allIssues.filter((issue) => this.matchesFilters(issue));
    const sourceGroups = this.buildSourceGroups(filteredIssues);

    this.vm = {
      hasWorkbook,
      totalIssues: allIssues.length,
      filteredIssues: filteredIssues.length,
      criticalCount: filteredIssues.filter((item) => item.severity === 'critical').length,
      warningCount: filteredIssues.filter((item) => item.severity === 'warning').length,
      infoCount: filteredIssues.filter((item) => item.severity === 'info').length,
      sources,
      symbols,
      sourceGroups,
      issues: this.sortIssues(filteredIssues),
      emptyMessage: !hasWorkbook
        ? 'Importá el Excel para revisar la salud de los datos.'
        : allIssues.length === 0
          ? 'No se detectaron problemas relevantes en los datos cargados.'
          : filteredIssues.length === 0
            ? 'No hay problemas para los filtros seleccionados.'
            : null
    };
  }

  private toIssueView(finding: DataReviewFinding): DataReviewIssueView {
    const source = this.normalizeSource(finding.source);
    const symbol = this.normalizeSymbol(finding.symbol);
    const severityLabel = this.getSeverityLabel(finding.severity);
    const currentValueLabel = this.formatValue({
      severity: finding.severity,
      severityLabel,
      source,
      symbol,
      problem: finding.problem,
      suggestion: finding.suggestion,
      currentValue: finding.currentValue,
      currency: finding.currency,
      currentValueLabel: '',
      actionLabel: '',
      actionLink: null,
      searchText: ''
    });
    const action = this.resolveAction(source, symbol);

    return {
      severity: finding.severity,
      severityLabel,
      source,
      symbol,
      problem: this.normalizeText(finding.problem),
      suggestion: this.normalizeText(finding.suggestion || 'Revisar en Excel'),
      currentValue: finding.currentValue,
      currency: finding.currency,
      currentValueLabel,
      actionLabel: action.label,
      actionLink: action.link,
      searchText: this.normalizeText([
        source,
        symbol,
        finding.problem,
        finding.suggestion,
        finding.category,
        finding.currency ?? ''
      ].join(' '))
    };
  }

  private matchesFilters(issue: DataReviewIssueView): boolean {
    if (this.filters.severity !== 'all' && issue.severity !== this.filters.severity) {
      return false;
    }
    if (this.filters.source !== 'all' && issue.source !== this.filters.source) {
      return false;
    }
    if (this.filters.symbol !== 'all' && issue.symbol !== this.filters.symbol) {
      return false;
    }
    const query = this.normalizeText(this.filters.text.trim()).toLowerCase();
    if (query) {
      return issue.searchText.toLowerCase().includes(query);
    }
    return true;
  }

  private buildSourceGroups(issues: DataReviewIssueView[]): DataReviewSourceGroup[] {
    const groups = new Map<string, number>();
    for (const issue of issues) {
      groups.set(issue.source, (groups.get(issue.source) ?? 0) + 1);
    }
    return [...groups.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => a.source.localeCompare(b.source, 'es'));
  }

  private sortIssues(issues: DataReviewIssueView[]): DataReviewIssueView[] {
    const severityOrder: Record<ReviewSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2
    };

    return [...issues].sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      const sourceDiff = a.source.localeCompare(b.source, 'es');
      if (sourceDiff !== 0) {
        return sourceDiff;
      }
      return a.symbol.localeCompare(b.symbol, 'es');
    });
  }

  private resolveAction(source: string, symbol: string): { label: string; link: string | null } {
    if (symbol) {
      return { label: 'Ver especie', link: `/posiciones/${encodeURIComponent(symbol)}` };
    }

    if (source === 'Señales') {
      return { label: 'Ir a alertas', link: '/alertas' };
    }

    if (source === 'Tabla35') {
      return { label: 'Ir a estrategia', link: '/estrategia' };
    }

    if (source === 'Tabla9' || source === 'HistorialMensualReconstruido') {
      return { label: 'Ir a decisiones', link: '/decisiones' };
    }

    if (source === 'Histórico') {
      return { label: 'Ir a histórico', link: '/historico' };
    }

    return { label: 'Revisar Excel', link: null };
  }

  private normalizeSource(source: string): string {
    const text = this.normalizeText(source).trim();
    if (text === '5D' || text === '30D') {
      return 'Señales';
    }
    if (text === 'WorkbookValidation') {
      return 'Validación';
    }
    if (text === 'clasificacion') {
      return 'Clasificación';
    }
    if (text.toLowerCase() === 'clasificación') {
      return 'Clasificación';
    }
    if (text.toLowerCase() === 'histórico' || text.toLowerCase() === 'historico') {
      return 'Histórico';
    }
    if (text.toLowerCase() === 'historialmensualreconstruido') {
      return 'HistorialMensualReconstruido';
    }
    return text;
  }

  private normalizeSymbol(symbol: string | null): string {
    return symbol ? this.normalizeText(symbol).trim().toUpperCase() : 'General';
  }

  private getSeverityLabel(severity: ReviewSeverity): string {
    switch (severity) {
      case 'critical':
        return 'Crítica';
      case 'warning':
        return 'Advertencia';
      default:
        return 'Info';
    }
  }

  private normalizeText(value: string): string {
    return value
      .replace(/á/g, 'á')
      .replace(/é/g, 'é')
      .replace(/í/g, 'í')
      .replace(/ó/g, 'ó')
      .replace(/ú/g, 'ú')
      .replace(/ñ/g, 'ñ')
      .replace(/Ã/g, 'Á')
      .replace(/Ã‰/g, 'É')
      .replace(/Ã/g, 'Í')
      .replace(/Ã“/g, 'Ó')
      .replace(/Ãš/g, 'Ú')
      .replace(/Ã‘/g, 'Ñ')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ãœ/g, 'Ü');
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  private emptyReport(): DataReviewReport {
    return {
      summary: {
        criticalProblems: 0,
        warnings: 0,
        uncategorizedAssets: 0,
        assetsWithoutHistory: 0,
        alertsToReview: 0,
        incompleteSignals: 0,
        strategicSplitIssues: 0,
        status: 'ok'
      },
      findings: []
    };
  }
}
