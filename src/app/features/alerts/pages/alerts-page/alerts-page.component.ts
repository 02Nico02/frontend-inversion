import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CombinedAlert } from '../../../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { PortfolioPosition } from '../../../../core/models/portfolio.models';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../../../core/services/privacy-mode.service';

type AlertTab = 'manual' | 'calculated' | 'signal5d' | 'signal30d' | 'all';
type AlertStateFilter = 'all' | 'activated' | 'near' | 'far' | 'error' | 'falls' | 'recoveries' | 'doubtful';
type AlertTypeFilter = 'all' | 'manual' | 'calculated' | 'signal5d' | 'signal30d' | 'doubtful';
type AlertSeverityFilter = 'all' | 'critical' | 'warning' | 'info' | 'success';
type AlertDistanceFilter = 'all' | 'lt2' | 'lt5' | 'lt10' | 'gt10';
type AlertCurrencyFilter = 'all' | 'ARS' | 'USD' | 'UNKNOWN';

interface AlertPageFilters {
  symbol: string;
  state: AlertStateFilter;
  type: AlertTypeFilter;
  severity: AlertSeverityFilter;
  distance: AlertDistanceFilter;
  currency: AlertCurrencyFilter;
  includeDoubtfulSignals: boolean;
}

interface AlertSummaryCard {
  label: string;
  value: number;
  tone: 'critical' | 'warning' | 'success' | 'info';
}

interface AlertTableRow {
  symbol: string;
  kind: 'manual' | 'calculated' | 'signal';
  status: string;
  condition: string;
  currentPrice: number | null;
  targetPrice: number | null;
  distancePercent: number | null;
  note: string;
  observation: string;
  currency: AlertCurrencyFilter;
  severity: AlertSeverityFilter;
  actionLink: string;
  period: '5D' | '30D' | null;
  signalType: 'caida' | 'recuperacion' | null;
  startDate: string | null;
  endDate: string | null;
  variationPercent: number | null;
  isScaleError: boolean;
  isDoubtfulSignal: boolean;
  stateKey: AlertStateFilter;
  typeKey: AlertTypeFilter;
  sortScore: number;
}

interface AlertsPageViewModel {
  hasWorkbook: boolean;
  totalAlerts: number;
  filteredAlerts: number;
  tabCounts: Record<AlertTab, number>;
  cards: AlertSummaryCard[];
  manualRows: AlertTableRow[];
  signal5dRows: AlertTableRow[];
  signal30dRows: AlertTableRow[];
  emptyMessage: string | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './alerts-page.component.html',
  styleUrls: ['./alerts-page.component.scss'],
})
export class AlertsPageComponent implements OnInit, OnDestroy {
  readonly tabs: Array<{ key: AlertTab; label: string }> = [
    { key: 'manual', label: 'Manuales' },
    { key: 'calculated', label: 'Calculadas' },
    { key: 'signal5d', label: 'Señales 5D' },
    { key: 'signal30d', label: 'Señales 30D' },
    { key: 'all', label: 'Todas' }
  ];

  readonly stateOptions: Array<{ value: AlertStateFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'activated', label: 'Activadas' },
    { value: 'near', label: 'Cercanas' },
    { value: 'far', label: 'Lejanas' },
    { value: 'error', label: 'Posible error' },
    { value: 'falls', label: 'Caídas' },
    { value: 'recoveries', label: 'Recuperaciones' },
    { value: 'doubtful', label: 'Dudosas' }
  ];

  readonly typeOptions: Array<{ value: AlertTypeFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'manual', label: 'Manual' },
    { value: 'calculated', label: 'Calculada' },
    { value: 'signal5d', label: 'Señal 5D' },
    { value: 'signal30d', label: 'Señal 30D' },
    { value: 'doubtful', label: 'Dudosa' }
  ];

  readonly severityOptions: Array<{ value: AlertSeverityFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'critical', label: 'Crítica' },
    { value: 'warning', label: 'Advertencia' },
    { value: 'info', label: 'Informativa' },
    { value: 'success', label: 'OK' }
  ];

  readonly distanceOptions: Array<{ value: AlertDistanceFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'lt2', label: 'Menor a 2%' },
    { value: 'lt5', label: 'Menor a 5%' },
    { value: 'lt10', label: 'Menor a 10%' },
    { value: 'gt10', label: 'Mayor a 10%' }
  ];

  readonly currencyOptions: Array<{ value: AlertCurrencyFilter; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'ARS', label: 'ARS' },
    { value: 'USD', label: 'USD' },
    { value: 'UNKNOWN', label: 'Sin moneda' }
  ];

  activeTab: AlertTab = 'manual';
  filters: AlertPageFilters = {
    symbol: '',
    state: 'all',
    type: 'all',
    severity: 'all',
    distance: 'all',
    currency: 'all',
    includeDoubtfulSignals: true
  };

  vm: AlertsPageViewModel | null = null;

  private readonly subscription = new Subscription();

  constructor(
    public readonly state: PortfolioStateService,
    public readonly privacyMode: PrivacyModeService,
    private readonly calculator: PortfolioCalculatorService,
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

  setActiveTab(tab: AlertTab): void {
    this.activeTab = tab;
    this.refreshVm();
  }

  onFiltersChange(): void {
    this.refreshVm();
  }

  clearFilters(): void {
    this.filters = {
      symbol: '',
      state: 'all',
      type: 'all',
      severity: 'all',
      distance: 'all',
      currency: 'all',
      includeDoubtfulSignals: true
    };
    this.refreshVm();
  }

  trackByRow(_index: number, row: AlertTableRow): string {
    return `${row.kind}:${row.symbol}:${row.period ?? 'na'}:${row.startDate ?? 'na'}:${row.endDate ?? 'na'}`;
  }

  formatMoney(value: number | null, currency: AlertCurrencyFilter): string {
    return this.currencyMapper.formatCurrency(value, currency === 'UNKNOWN' ? null : currency);
  }

  formatPercent(value: number | null): string {
    return this.currencyMapper.formatPercentage(value);
  }

  formatNumber(value: number | null): string {
    return this.currencyMapper.formatNumber(value);
  }

  formatCurrencyLabel(value: AlertCurrencyFilter): string {
    return this.currencyMapper.getCurrencyLabel(value);
  }

  formatText(value: string | null | undefined): string {
    return value ? value : 'N/D';
  }

  getTabCount(tab: AlertTab): number {
    return this.vm?.tabCounts[tab] ?? 0;
  }

  private refreshVm(): void {
    const snapshot = this.state.snapshot;
    const hasWorkbook = snapshot.status === 'ready' && !!snapshot.dataset;
    const allRows = hasWorkbook ? this.buildRows(snapshot) : [];
    const filteredRows = allRows.filter((row) => this.matchesFilters(row));
    const visibleRows = filteredRows.filter((row) => this.matchesTab(row));
    const manualRows = this.sortManualRows(visibleRows.filter((row) => row.kind !== 'signal'));
    const signal5dRows = this.sortSignalRows(visibleRows.filter((row) => row.kind === 'signal' && row.period === '5D'));
    const signal30dRows = this.sortSignalRows(visibleRows.filter((row) => row.kind === 'signal' && row.period === '30D'));
    const signalRows = [...signal5dRows, ...signal30dRows];
    const tabCounts: Record<AlertTab, number> = {
      manual: filteredRows.filter((row) => row.kind === 'manual').length,
      calculated: filteredRows.filter((row) => row.kind === 'calculated').length,
      signal5d: filteredRows.filter((row) => row.kind === 'signal' && row.period === '5D').length,
      signal30d: filteredRows.filter((row) => row.kind === 'signal' && row.period === '30D').length,
      all: filteredRows.length
    };

    this.vm = {
      hasWorkbook,
      totalAlerts: allRows.length,
      filteredAlerts: visibleRows.length,
      tabCounts,
      cards: [
        { label: 'Activadas', value: visibleRows.filter((row) => row.stateKey === 'activated').length, tone: 'success' },
        { label: 'Cercanas', value: visibleRows.filter((row) => row.stateKey === 'near').length, tone: 'warning' },
        { label: 'Posibles errores', value: visibleRows.filter((row) => row.isScaleError || row.isDoubtfulSignal).length, tone: 'critical' },
        { label: 'Señales recientes', value: signalRows.length, tone: 'info' }
      ],
      manualRows,
      signal5dRows,
      signal30dRows,
      emptyMessage: !hasWorkbook
        ? 'Importá el Excel para ver alertas y señales.'
        : visibleRows.length === 0
          ? 'No hay alertas para los filtros seleccionados.'
          : null
    };
  }

  private buildRows(snapshot: PortfolioAppState): AlertTableRow[] {
    const positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    const positionBySymbol = new Map(positions.map((position) => [position.symbol.toUpperCase(), position]));

    return (snapshot.combinedAlerts ?? [])
      .map((alert) => this.toRow(alert, positionBySymbol))
      .filter((row): row is AlertTableRow => row !== null);
  }

  private toRow(alert: CombinedAlert, positionBySymbol: Map<string, PortfolioPosition>): AlertTableRow | null {
    if (!alert.symbol) {
      return null;
    }

    const symbol = String(alert.symbol).toUpperCase();
    const position = positionBySymbol.get(symbol) ?? null;
    const currency = this.normalizeCurrency(position?.currency ?? null);
    const isSignal = alert.group === 'signal';
    const period = this.resolvePeriod(alert);
    const signalType = isSignal ? this.normalizeSignalType(alert.signalType) : null;
    const currentPrice = this.numberOrNull(alert.currentPrice ?? position?.currentPrice ?? null);
    const targetPrice = this.numberOrNull(alert.targetPrice ?? null);
    const distancePercent = this.numberOrNull(alert.distancePercent ?? null);
    const isScaleError = this.isScaleError(distancePercent);
    const isDoubtfulSignal = isSignal && this.isDoubtfulSignal(position, symbol);
    const stateKey = this.resolveStateKey(alert, signalType, distancePercent, isScaleError, isDoubtfulSignal);
    const typeKey = this.resolveTypeKey(alert, period, isDoubtfulSignal);
    const severity = this.resolveSeverity(alert, stateKey, isScaleError, isDoubtfulSignal);
    const condition = this.resolveCondition(alert, period, isDoubtfulSignal);
    const observation = this.resolveObservation(alert, position, isScaleError, isDoubtfulSignal, period);

    return {
      symbol,
      kind: alert.group,
      status: this.resolveStatusLabel(alert, stateKey, signalType, isDoubtfulSignal),
      condition,
      currentPrice,
      targetPrice,
      distancePercent,
      note: this.resolveNote(alert, position, isDoubtfulSignal),
      observation,
      currency,
      severity,
      actionLink: `/posiciones/${encodeURIComponent(symbol)}`,
      period,
      signalType,
      startDate: this.formatDate(alert.startDate ?? null),
      endDate: this.formatDate(alert.endDate ?? null),
      variationPercent: isSignal ? distancePercent : null,
      isScaleError,
      isDoubtfulSignal,
      stateKey,
      typeKey,
      sortScore: this.sortScore(alert, stateKey, period, signalType, distancePercent, isScaleError, isDoubtfulSignal)
    };
  }

  private matchesTab(row: AlertTableRow): boolean {
    switch (this.activeTab) {
      case 'manual':
        return row.kind === 'manual';
      case 'calculated':
        return row.kind === 'calculated';
      case 'signal5d':
        return row.kind === 'signal' && row.period === '5D';
      case 'signal30d':
        return row.kind === 'signal' && row.period === '30D';
      case 'all':
      default:
        return true;
    }
  }

  private matchesFilters(row: AlertTableRow): boolean {
    const symbolQuery = this.filters.symbol.trim().toUpperCase();
    if (symbolQuery && !row.symbol.toUpperCase().includes(symbolQuery)) {
      return false;
    }

    if (this.filters.currency !== 'all' && row.currency !== this.filters.currency) {
      return false;
    }

    if (this.filters.type !== 'all' && row.typeKey !== this.filters.type) {
      return false;
    }

    if (!this.filters.includeDoubtfulSignals && row.isDoubtfulSignal) {
      return false;
    }

    if (this.filters.state !== 'all' && row.stateKey !== this.filters.state) {
      return false;
    }

    if (this.filters.severity !== 'all' && row.severity !== this.filters.severity) {
      return false;
    }

    if (this.filters.distance !== 'all' && !this.matchesDistance(row)) {
      return false;
    }

    return true;
  }

  private matchesDistance(row: AlertTableRow): boolean {
    const value = Math.abs(row.distancePercent ?? Infinity);
    switch (this.filters.distance) {
      case 'lt2':
        return value < 2;
      case 'lt5':
        return value < 5;
      case 'lt10':
        return value < 10;
      case 'gt10':
        return value > 10;
      default:
        return true;
    }
  }

  private sortManualRows(rows: AlertTableRow[]): AlertTableRow[] {
    return [...rows].sort((a, b) => {
      if (a.isScaleError !== b.isScaleError) {
        return a.isScaleError ? -1 : 1;
      }
      const rank = this.manualRank(a.stateKey) - this.manualRank(b.stateKey);
      if (rank !== 0) {
        return rank;
      }
      return Math.abs(a.distancePercent ?? Infinity) - Math.abs(b.distancePercent ?? Infinity);
    });
  }

  private sortSignalRows(rows: AlertTableRow[]): AlertTableRow[] {
    return [...rows].sort((a, b) => {
      if (a.isScaleError !== b.isScaleError) {
        return a.isScaleError ? -1 : 1;
      }
      const rank = this.signalRank(a) - this.signalRank(b);
      if (rank !== 0) {
        return rank;
      }
      return Math.abs((a.variationPercent ?? a.distancePercent) ?? Infinity) - Math.abs((b.variationPercent ?? b.distancePercent) ?? Infinity);
    });
  }

  private sortScore(
    alert: CombinedAlert,
    stateKey: AlertStateFilter,
    period: '5D' | '30D' | null,
    signalType: 'caida' | 'recuperacion' | null,
    distancePercent: number | null,
    isScaleError: boolean,
    isDoubtfulSignal: boolean
  ): number {
    if (isScaleError) {
      return 0;
    }
    if (alert.group === 'signal') {
      if (signalType === 'caida') {
        return 100 - Math.abs(distancePercent ?? 0);
      }
      if (signalType === 'recuperacion') {
        return 200 - Math.abs(distancePercent ?? 0);
      }
      if (isDoubtfulSignal) {
        return 300;
      }
      return period === '30D' ? 400 : 500;
    }
    return this.manualRank(stateKey) * 100 + Math.abs(distancePercent ?? 0);
  }

  private manualRank(state: AlertStateFilter): number {
    switch (state) {
      case 'activated':
        return 0;
      case 'near':
        return 1;
      case 'far':
        return 2;
      case 'error':
        return 3;
      case 'falls':
      case 'recoveries':
      case 'doubtful':
      case 'all':
      default:
        return 4;
    }
  }

  private signalRank(row: AlertTableRow): number {
    if (row.isScaleError) {
      return 0;
    }
    if (row.signalType === 'caida') {
      return 1;
    }
    if (row.signalType === 'recuperacion') {
      return 2;
    }
    if (row.isDoubtfulSignal) {
      return 3;
    }
    return 4;
  }

  private resolveStateKey(
    alert: CombinedAlert,
    signalType: 'caida' | 'recuperacion' | null,
    distancePercent: number | null,
    isScaleError: boolean,
    isDoubtfulSignal: boolean
  ): AlertStateFilter {
    if (isScaleError) {
      return 'error';
    }
    if (alert.group === 'signal') {
      if (isDoubtfulSignal) {
        return 'doubtful';
      }
      if (signalType === 'caida') {
        return 'falls';
      }
      if (signalType === 'recuperacion') {
        return 'recoveries';
      }
      return 'near';
    }

    const normalizedStatus = String(alert.status ?? '').toLowerCase();
    const activated = normalizedStatus.includes('activada');
    const near = distancePercent !== null && Math.abs(distancePercent) <= 5;
    if (activated) {
      return 'activated';
    }
    if (near) {
      return 'near';
    }
    return 'far';
  }

  private resolveTypeKey(alert: CombinedAlert, period: '5D' | '30D' | null, isDoubtfulSignal: boolean): AlertTypeFilter {
    if (alert.group === 'manual') {
      return 'manual';
    }
    if (alert.group === 'calculated') {
      return 'calculated';
    }
    if (isDoubtfulSignal) {
      return 'doubtful';
    }
    if (period === '5D') {
      return 'signal5d';
    }
    if (period === '30D') {
      return 'signal30d';
    }
    return 'all';
  }

  private resolveSeverity(
    alert: CombinedAlert,
    stateKey: AlertStateFilter,
    isScaleError: boolean,
    isDoubtfulSignal: boolean
  ): AlertSeverityFilter {
    if (isScaleError || isDoubtfulSignal || stateKey === 'error') {
      return 'critical';
    }
    if (stateKey === 'activated' || stateKey === 'recoveries') {
      return 'success';
    }
    if (stateKey === 'near' || stateKey === 'falls') {
      return 'warning';
    }
    if (alert.group === 'calculated') {
      return 'info';
    }
    return 'info';
  }

  private resolveStatusLabel(
    alert: CombinedAlert,
    stateKey: AlertStateFilter,
    signalType: 'caida' | 'recuperacion' | null,
    isDoubtfulSignal: boolean
  ): string {
    if (alert.group === 'signal') {
      if (isDoubtfulSignal) {
        return 'Señal dudosa';
      }
      return signalType === 'recuperacion' ? 'Recuperación' : 'Caída';
    }

    switch (stateKey) {
      case 'activated':
        return 'Activada';
      case 'near':
        return 'Cercana';
      case 'far':
        return 'Lejana';
      case 'error':
        return 'Posible error';
      default:
        return alert.status || 'N/D';
    }
  }

  private resolveCondition(alert: CombinedAlert, period: '5D' | '30D' | null, isDoubtfulSignal: boolean): string {
    if (alert.group === 'manual') {
      return alert.note || 'Manual';
    }
    if (alert.group === 'calculated') {
      return alert.priority || 'Calculada';
    }
    if (isDoubtfulSignal) {
      return 'Señal técnica no comparable';
    }
    return period === '30D' ? 'Señal 30D' : 'Señal 5D';
  }

  private resolveObservation(
    alert: CombinedAlert,
    position: PortfolioPosition | null,
    isScaleError: boolean,
    isDoubtfulSignal: boolean,
    period: '5D' | '30D' | null
  ): string {
    if (isScaleError) {
      return 'Revisar escala del precio actual/objetivo';
    }
    if (isDoubtfulSignal) {
      return 'Señal técnica no comparable';
    }
    if (alert.group === 'signal') {
      return period === '30D' ? 'Señal de seguimiento 30D' : 'Señal de seguimiento 5D';
    }
    if (alert.note) {
      return alert.note;
    }
    if (position?.positionType) {
      return position.positionType;
    }
    return 'Sin observación';
  }

  private resolveNote(alert: CombinedAlert, position: PortfolioPosition | null, isDoubtfulSignal: boolean): string {
    if (isDoubtfulSignal) {
      return 'Señal técnica no comparable';
    }
    if (alert.note) {
      return alert.note;
    }
    if (position?.assetType) {
      return position.assetType;
    }
    return 'N/D';
  }

  private isDoubtfulSignal(position: PortfolioPosition | null, symbol: string): boolean {
    const combined = `${position?.assetType ?? ''} ${position?.positionType ?? ''}`.toUpperCase();
    return combined.includes('FCI')
      || combined.includes('MONEY MARKET')
      || combined.includes('VALORIZADO')
      || ['IOLCAMA', 'PRPEDOB', 'IOLDOLD'].includes(symbol.toUpperCase());
  }

  private isScaleError(distancePercent: number | null): boolean {
    return distancePercent !== null && Math.abs(distancePercent) > 80;
  }

  private resolvePeriod(alert: CombinedAlert): '5D' | '30D' | null {
    if (alert.period === '5D' || alert.period === '30D') {
      return alert.period;
    }
    const priority = String(alert.priority ?? '').toUpperCase();
    if (priority.includes('30D')) {
      return '30D';
    }
    if (priority.includes('5D')) {
      return '5D';
    }
    const note = String(alert.note ?? '').toUpperCase();
    if (note.includes('30D')) {
      return '30D';
    }
    if (note.includes('5D')) {
      return '5D';
    }
    const status = String(alert.status ?? '').toUpperCase();
    if (status.includes('30D')) {
      return '30D';
    }
    if (status.includes('5D')) {
      return '5D';
    }
    return null;
  }

  private normalizeSignalType(value: string | null | undefined): 'caida' | 'recuperacion' | null {
    const text = String(value ?? '').toLowerCase();
    if (text.includes('caid')) {
      return 'caida';
    }
    if (text.includes('recuper')) {
      return 'recuperacion';
    }
    return null;
  }

  private normalizeCurrency(currency: string | null | undefined): AlertCurrencyFilter {
    const normalized = this.currencyMapper.normalizeCurrency(currency);
    return normalized === 'UNKNOWN' ? 'UNKNOWN' : normalized;
  }

  private numberOrNull(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private formatDate(value: string | Date | null | undefined): string {
    if (!value) {
      return 'N/D';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/D';
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}
