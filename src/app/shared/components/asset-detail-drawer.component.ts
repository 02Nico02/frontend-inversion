import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombinedAlert } from '../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../core/services/currency-mapper.service';
import { AssetClassification, HistoricalPrice, InvestmentOperation, PortfolioPosition } from '../../core/models/portfolio.models';
import { parseExcelDate } from '../../core/utils/value-parsing.utils';
import { SimpleChartComponent } from './simple-chart.component';

type DetailTab = 'summary' | 'operations' | 'alerts' | 'history' | 'classification';
type SortDirection = 'asc' | 'desc';
type PageSize = 10 | 25 | 50 | 'all';
type Period = 'ALL' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'CUSTOM';

@Component({
  selector: 'app-asset-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  template: `
    <ng-container *ngIf="open && position as asset">
      <div class="backdrop" (click)="close.emit()" aria-hidden="true"></div>
      <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="'Detalle de ' + asset.symbol">
        <header class="drawer-header">
          <div class="header-copy">
            <p class="eyebrow">Detalle de especie</p>
            <h2>{{ asset.symbol }}</h2>
            <p class="subtitle">{{ headerSummary(asset) }}</p>
            <p class="headline">
              Resultado: <strong [class.positive]="asset.resultAmount >= 0" [class.negative]="asset.resultAmount < 0">{{ formatMoney(asset.resultAmount, asset.currency) }}</strong>
              |
              <strong [class.positive]="(asset.resultPercent ?? 0) >= 0" [class.negative]="(asset.resultPercent ?? 0) < 0">{{ formatPercent(asset.resultPercent) }}</strong>
            </p>
          </div>
          <button type="button" class="close" (click)="close.emit()" aria-label="Cerrar detalle">×</button>
        </header>

        <nav class="tabs">
          <button type="button" [class.active]="tab === 'summary'" (click)="tab = 'summary'">Resumen</button>
          <button type="button" [class.active]="tab === 'operations'" (click)="tab = 'operations'">Compras</button>
          <button type="button" [class.active]="tab === 'alerts'" (click)="tab = 'alerts'">Alertas</button>
          <button type="button" [class.active]="tab === 'history'" (click)="tab = 'history'">Histórico</button>
          <button type="button" [class.active]="tab === 'classification'" (click)="tab = 'classification'">Clasificación</button>
        </nav>

        <div class="drawer-body">
                    <section *ngIf="tab === 'summary'" class="tab-content">
            <div class="compact-groups">
              <section class="compact-block">
                <h3>Posición</h3>
                <div class="kv-grid">
                  <div><span>Total actual</span><strong>{{ formatMoney(asset.currentValue, asset.currency) }}</strong></div>
                  <div><span>Total invertido</span><strong>{{ formatMoney(asset.totalInvested, asset.currency) }}</strong></div>
                  <div><span>Resultado $</span><strong [class.positive]="asset.resultAmount >= 0" [class.negative]="asset.resultAmount < 0">{{ formatMoney(asset.resultAmount, asset.currency) }}</strong></div>
                  <div><span>Resultado %</span><strong [class.positive]="(asset.resultPercent ?? 0) >= 0" [class.negative]="(asset.resultPercent ?? 0) < 0">{{ formatPercent(asset.resultPercent) }}</strong></div>
                  <div><span>Cantidad</span><strong>{{ formatNumber(asset.quantity) }}</strong></div>
                  <div><span>Precio promedio</span><strong>{{ formatMoney(asset.averagePrice, asset.currency) }}</strong></div>
                  <div><span>Precio actual</span><strong>{{ formatMoney(asset.currentPrice, asset.currency) }}</strong></div>
                </div>
              </section>

              <section class="compact-block">
                <h3>Peso y objetivo</h3>
                <ng-container *ngIf="expectedMetrics(asset) as expected">
                  <div class="kv-grid">
                    <div><span>Peso en moneda</span><strong>{{ formatPercent(weightFor(asset.symbol)) }}</strong></div>
                    <div><span>Total moneda</span><strong>{{ currencyTotal(asset.currency) }}</strong></div>
                    <div><span>Monto esperado</span><strong>{{ expected.hasTarget ? formatMoney(expected.expected, asset.currency) : 'Sin objetivo definido' }}</strong></div>
                    <div><span>Diferencia</span><strong>{{ expected.hasTarget ? formatMoney(expected.delta, asset.currency) : 'Sin objetivo definido' }}</strong></div>
                    <div><span>Desvío vs esperado</span><strong>{{ expected.hasTarget ? formatPercent(expected.deviation) : 'Sin objetivo definido' }}</strong></div>
                  </div>
                </ng-container>
              </section>

              <section class="compact-block">
                <h3>Clasificación resumida</h3>
                <div class="kv-grid">
                  <div><span>Tipo activo</span><strong>{{ classification(asset)?.type || 'Sin datos' }}</strong></div>
                  <div><span>Sector</span><strong>{{ classification(asset)?.sector || 'Sin sector' }}</strong></div>
                  <div><span>Subsector</span><strong>{{ classification(asset)?.subsector || 'Sin subsector' }}</strong></div>
                  <div><span>Región</span><strong>{{ classification(asset)?.region || 'Sin región' }}</strong></div>
                </div>
              </section>
            </div>
          </section>

          <section *ngIf="tab === 'operations'" class="tab-content">
            <div class="section-head">
              <div>
                <p class="eyebrow">Tabla 6</p>
                <h3>Compras / lotes</h3>
              </div>
              <div class="controls">
                <label>
                  <span>Orden</span>
                  <select [(ngModel)]="operationSortDirection">
                    <option value="desc">Más recientes</option>
                    <option value="asc">Más antiguas</option>
                  </select>
                </label>
                <label>
                  <span>Filas</span>
                  <select [(ngModel)]="operationPageSize">
                    <option [ngValue]="10">10</option>
                    <option [ngValue]="25">25</option>
                    <option [ngValue]="50">50</option>
                    <option [ngValue]="'all'">Todas</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="summary-strip">
              <span>Compras/lotes: {{ operationsFor(asset.symbol).length }}</span>
              <span>Cantidad total: {{ formatNumber(totalQuantity(asset.symbol)) }}</span>
              <span>Total invertido: {{ formatMoney(totalInvested(asset.symbol), asset.currency) }}</span>
              <span>Valor actual: {{ formatMoney(totalCurrent(asset.symbol), asset.currency) }}</span>
              <span>Resultado: {{ formatMoney(totalCurrent(asset.symbol) - totalInvested(asset.symbol), asset.currency) }}</span>
              <span>Rendimiento: {{ weightedReturn(asset.symbol) }}</span>
              <span>Precio promedio ponderado: {{ formatMoney(weightedAveragePrice(asset.symbol), asset.currency) }}</span>
            </div>

            <div class="mini-table">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th class="num">Cantidad</th>
                    <th class="num">Precio compra</th>
                    <th class="num">Total invertido</th>
                    <th class="num">Precio actual</th>
                    <th class="num">Valor actual</th>
                    <th class="num">Resultado $</th>
                    <th class="num">Resultado %</th>
                    <th>Avanzado</th>
                  </tr>
                </thead>
                <tbody>
                  <ng-container *ngFor="let operation of pagedOperations(asset.symbol); trackBy: trackByOperationId">
                    <tr>
                    <td>{{ formatDate(operation.date) }}</td>
                    <td class="num">{{ formatNumber(operation.quantity) }}</td>
                    <td class="num">{{ formatMoney(operation.buyPrice, operation.currency) }}</td>
                    <td class="num">{{ formatMoney(operation.total, operation.currency) }}</td>
                    <td class="num">{{ formatMoney(operation.currentPrice, operation.currency) }}</td>
                    <td class="num">{{ formatMoney(operation.currentValue, operation.currency) }}</td>
                    <td class="num" [class.positive]="(operationResult(operation) ?? 0) >= 0" [class.negative]="(operationResult(operation) ?? 0) < 0">{{ formatMoney(operationResult(operation), asset.currency) }}</td>
                    <td class="num" [class.positive]="(operationResultPercent(operation) ?? 0) >= 0" [class.negative]="(operationResultPercent(operation) ?? 0) < 0">{{ formatPercent(operationResultPercent(operation)) }}</td>
                    <td>
                      <details class="lot-details">
                        <summary>Ver ID, moneda y métricas</summary>
                        <div class="lot-advanced">
                          <span>ID: {{ operation.id }}</span>
                          <span>Moneda: {{ currencyLabel(operation.currency) }}</span>
                          <span>Monto: {{ formatMoney(operation.amount, operation.currency) }}</span>
                          <span>TEM: {{ formatPercent(operation.monthlyRate) }}</span>
                          <span>TNA: {{ formatPercent(operation.annualRate) }}</span>
                          <span>TOP: {{ operation.top || 'Sin datos' }}</span>
                          <span>Tendencia: {{ operation.trend || 'Sin datos' }}</span>
                          <span>Peso lote: {{ formatPercent(lotWeight(operation)) }}</span>
                        </div>
                      </details>
                    </td>
                  </tr>
                  </ng-container>
                </tbody>
              </table>
            </div>

            <div class="pager" *ngIf="operationPageCount(asset.symbol) > 1">
              <span>Página {{ currentOperationPageIndex + 1 }} de {{ operationPageCount(asset.symbol) }}</span>
              <div class="pager-actions">
                <button type="button" (click)="firstOperationPage()" [disabled]="currentOperationPageIndex === 0">Primera</button>
                <button type="button" (click)="previousOperationPage()" [disabled]="currentOperationPageIndex === 0">Anterior</button>
                <button type="button" (click)="nextOperationPage(asset.symbol)" [disabled]="currentOperationPageIndex >= operationPageCount(asset.symbol) - 1">Siguiente</button>
                <button type="button" (click)="lastOperationPage(asset.symbol)" [disabled]="currentOperationPageIndex >= operationPageCount(asset.symbol) - 1">Última</button>
              </div>
            </div>
          </section>

                    <section *ngIf="tab === 'alerts'" class="tab-content">
            <div class="alert-groups">
              <div class="group">
                <h3>Manuales</h3>
                <div *ngIf="manualAlerts(asset.symbol).length; else emptyAlerts">
                  <table class="alert-table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Condición</th>
                        <th class="num">Actual</th>
                        <th class="num">Objetivo</th>
                        <th class="num">Distancia</th>
                        <th>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let alert of sortedManualAlerts(asset.symbol)" [class.activated]="alert.status === 'activada'" [class.near]="alert.status === 'cerca'" [class.outside]="alert.status === 'lejos' || alert.status === 'inactiva'">
                        <td>{{ alert.status }}</td>
                        <td>{{ alert.priority }}</td>
                        <td class="num">{{ formatNumber(alert.currentPrice) }}</td>
                        <td class="num">{{ formatNumber(alert.targetPrice) }}</td>
                        <td class="num">{{ formatPercent(alert.distancePercent) }}</td>
                        <td>{{ alert.note || 'Sin nota' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="group">
                <h3>Calculadas</h3>
                <div *ngIf="calculatedAlerts(asset.symbol).length; else emptyAlerts" class="alert-list">
                  <article class="alert-card" *ngFor="let alert of calculatedAlerts(asset.symbol)">
                    <strong>{{ alert.status }}</strong>
                    <span>Prioridad: {{ alert.priority }}</span>
                    <span>Actual: {{ formatNumber(alert.currentPrice) }}</span>
                    <span>Objetivo: {{ formatNumber(alert.targetPrice) }}</span>
                    <span>Distancia: {{ formatPercent(alert.distancePercent) }}</span>
                  </article>
                </div>
              </div>
              <div class="group">
                <h3>Señales</h3>
                <div *ngIf="signalAlerts(asset.symbol).length; else emptyAlerts" class="alert-list">
                  <article class="alert-card" *ngFor="let alert of sortedSignalAlerts(asset.symbol)">
                    <strong>{{ alert.period }} · {{ alert.signalType }}</strong>
                    <span>Inicio: {{ alert.startDate || 'N/D' }} · {{ formatNumber(alert.targetPrice) }}</span>
                    <span>Fin: {{ alert.endDate || 'N/D' }} · {{ formatNumber(alert.currentPrice) }}</span>
                    <span>Variación: {{ formatPercent(alert.distancePercent) }}</span>
                  </article>
                </div>
              </div>
            </div>
            <ng-template #emptyAlerts>
              <div class="empty">Esta especie no tiene alertas asociadas.</div>
            </ng-template>
          </section>

          <section *ngIf="tab === 'history'" class="tab-content">
            <div class="section-head">
              <div>
                <p class="eyebrow">Precio histórico</p>
                <h3>Serie por especie</h3>
              </div>
              <label>
                <span>Período</span>
                <select [(ngModel)]="historyPeriod">
                  <option value="ALL">Todo</option>
                  <option value="1M">1M</option>
                  <option value="3M">3M</option>
                  <option value="6M">6M</option>
                  <option value="YTD">YTD</option>
                  <option value="1Y">1A</option>
                </select>
              </label>
            </div>
            <app-simple-chart title="Precio histórico" [subtitle]="asset.symbol" mode="line" [points]="historicalSeries(asset.symbol)" [currency]="asset.currency" valueKind="money"></app-simple-chart>
            <div class="summary-strip" *ngIf="historyStats(asset.symbol) as stats">
              <span>Desde: {{ stats.startDate || 'N/D' }}</span>
              <span>Hasta: {{ stats.endDate || 'N/D' }}</span>
              <span>Inicial: {{ formatMoney(stats.initial, asset.currency) }}</span>
              <span>Final: {{ formatMoney(stats.final, asset.currency) }}</span>
              <span>Var: {{ formatMoney(stats.variationAmount, asset.currency) }}</span>
              <span>Var %: {{ formatPercent(stats.variationPercent) }}</span>
              <span>Registros: {{ stats.count }}</span>
              <span>Máx: {{ formatMoney(stats.max, asset.currency) }} ({{ stats.maxDate || 'N/D' }})</span>
              <span>Mín: {{ formatMoney(stats.min, asset.currency) }} ({{ stats.minDate || 'N/D' }})</span>
            </div>
          </section>

                    <section *ngIf="tab === 'classification'" class="tab-content">
            <div class="compact-block">
              <h3>Clasificación</h3>
              <div class="kv-grid">
                <div><span>Tipo de activo</span><strong>{{ classification(asset)?.type || 'Sin datos' }}</strong></div>
                <div><span>Sector</span><strong>{{ classification(asset)?.sector || 'Sin sector' }}</strong></div>
                <div><span>Subsector</span><strong>{{ classification(asset)?.subsector || 'Sin subsector' }}</strong></div>
                <div><span>Región</span><strong>{{ classification(asset)?.region || 'Sin región' }}</strong></div>
                <div><span>Tipo de posición</span><strong>{{ asset.positionType || 'Sin datos' }}</strong></div>
                <div><span>Moneda</span><strong>{{ currencyLabel(asset.currency) }}</strong></div>
                <div><span>Existe en Tabla47</span><strong>{{ classification(asset) ? 'Sí' : 'No' }}</strong></div>
                <div><span>Faltantes</span><strong>{{ missingClassification(asset) }}</strong></div>
                <div><span>Fuente</span><strong>Tabla47</strong></div>
                <div><span>Match</span><strong>Normalizado por especie</strong></div>
              </div>
              <div class="empty" *ngIf="missingClassification(asset) === 'Sin faltantes'">
                Clasificación completa.
              </div>
              <div class="empty" *ngIf="missingClassification(asset) !== 'Sin faltantes'">
                {{ classificationHelp(asset) }}
              </div>
            </div>
          </section>
        </div>
      </aside>
    </ng-container>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 40;
      pointer-events: none;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(4, 8, 18, 0.58);
      pointer-events: auto;
    }
    .drawer {
      position: absolute;
      top: 0;
      right: 0;
      width: min(44vw, 720px);
      height: 100%;
      background: #0f1730;
      border-left: 1px solid var(--panel-border);
      box-shadow: -24px 0 60px rgba(0, 0, 0, 0.35);
      display: grid;
      grid-template-rows: auto auto 1fr;
      pointer-events: auto;
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.2rem 1.2rem 0.9rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      align-items: start;
    }
    .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.74rem;
    }
    h2, h3, p { margin: 0; }
    .subtitle {
      margin-top: 0.2rem;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .headline {
      margin-top: 0.5rem;
      font-size: 0.95rem;
    }
    .close {
      border: 1px solid var(--panel-border);
      background: rgba(255,255,255,0.04);
      color: var(--text);
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 999px;
      cursor: pointer;
    }
    .tabs {
      display: flex;
      gap: 0.45rem;
      padding: 0.75rem 1.2rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      overflow: auto;
    }
    .tabs button {
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--panel-border);
      color: var(--text);
      border-radius: 999px;
      padding: 0.45rem 0.75rem;
      white-space: nowrap;
    }
    .tabs button.active {
      border-color: var(--brand);
      color: var(--brand);
    }
    .drawer-body {
      overflow: auto;
      padding: 1rem 1.2rem 1.2rem;
      display: grid;
      gap: 1rem;
    }
    .tab-content {
      display: grid;
      gap: 0.9rem;
    }
    .compact-groups {
      display: grid;
      gap: 0.8rem;
    }
    .compact-block {
      display: grid;
      gap: 0.55rem;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 0.8rem;
    }
    .compact-block h3 {
      font-size: 0.92rem;
    }
    .kv-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.55rem 0.75rem;
    }
    .kv-grid div {
      display: grid;
      gap: 0.15rem;
    }
    .kv-grid span {
      color: var(--muted);
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .kv-grid strong {
      font-size: 0.92rem;
      white-space: normal;
    }
    .metric-card, .alert-card, .empty {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 0.85rem;
    }
    .metric-card {
      display: grid;
      gap: 0.25rem;
    }
    .metric-card span, .section-head label, .controls label, .summary-strip, .empty {
      color: var(--muted);
      font-size: 0.82rem;
    }
    .metric-card strong {
      color: var(--text);
      font-size: 0.98rem;
      white-space: normal;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .controls {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: end;
    }
    .controls label, .section-head label {
      display: grid;
      gap: 0.25rem;
    }
    select {
      background: rgba(255,255,255,0.05);
      color: var(--text);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      padding: 0.55rem 0.7rem;
    }
    .summary-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .mini-table {
      overflow: auto;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 860px;
    }
    th, td {
      padding: 0.7rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      white-space: nowrap;
    }
    th {
      position: sticky;
      top: 0;
      background: #111b35;
      color: var(--muted);
      text-align: left;
      z-index: 1;
    }
    .num { text-align: right; }
    .pager {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .pager-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .pager button {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--text);
      border-radius: 10px;
      padding: 0.45rem 0.7rem;
    }
    .lot-details {
      color: var(--muted);
      font-size: 0.8rem;
    }
    .lot-details summary {
      cursor: pointer;
      color: var(--text);
    }
    .lot-advanced {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem 0.8rem;
      padding-top: 0.45rem;
    }
    .alert-groups {
      display: grid;
      gap: 0.9rem;
    }
    .group {
      display: grid;
      gap: 0.6rem;
    }
    .alert-table {
      width: 100%;
      border-collapse: collapse;
    }
    .alert-table th, .alert-table td {
      padding: 0.6rem 0.7rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      white-space: nowrap;
    }
    .alert-table th {
      color: var(--muted);
      text-align: left;
      font-size: 0.8rem;
    }
    .alert-table tr.activated {
      background: rgba(34, 197, 94, 0.08);
    }
    .alert-table tr.near {
      background: rgba(245, 158, 11, 0.08);
    }
    .alert-table tr.outside {
      opacity: 0.85;
    }
    .alert-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 0.75rem;
    }
    .alert-card {
      display: grid;
      gap: 0.2rem;
    }
    .positive { color: var(--ok); }
    .negative { color: #fb7185; }
    @media (max-width: 1100px) {
      .drawer {
        width: 100%;
        height: 84vh;
        top: auto;
        bottom: 0;
        right: 0;
        left: 0;
        border-left: 0;
        border-top: 1px solid var(--panel-border);
        border-radius: 18px 18px 0 0;
      }
    }
  `]
})
export class AssetDetailDrawerComponent {
  @Input() open = false;
  @Input() symbol: string | null = null;
  @Input() positions: PortfolioPosition[] = [];
  @Input() operations: InvestmentOperation[] = [];
  @Input() alerts: CombinedAlert[] = [];
  @Input() historicalPrices: HistoricalPrice[] = [];
  @Input() classifications: AssetClassification[] = [];
  @Output() close = new EventEmitter<void>();

  tab: DetailTab = 'summary';
  operationSortDirection: SortDirection = 'desc';
  operationPageSize: PageSize = 25;
  operationPageIndex = 0;
  historyPeriod: Period = 'ALL';

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.close.emit();
    }
  }

  get position(): PortfolioPosition | null {
    const symbol = this.symbol?.toUpperCase();
    if (!symbol) {
      return null;
    }
    return this.positions.find((item) => item.symbol.toUpperCase() === symbol) ?? null;
  }

  classification(position: PortfolioPosition): AssetClassification | null {
    const symbol = position.symbol.toUpperCase();
    return this.classifications.find((item) => item.symbol.toUpperCase() === symbol) ?? position.classification ?? null;
  }

  missingClassification(position: PortfolioPosition): string {
    const classification = this.classification(position);
    const missing = [
      !classification?.type ? 'tipo activo' : null,
      !classification?.sector ? 'sector' : null,
      !classification?.subsector ? 'subsector' : null,
      !classification?.region ? 'región' : null
    ].filter(Boolean);
    return missing.length ? missing.join(', ') : 'Sin faltantes';
  }

  headerSummary(position: PortfolioPosition): string {
    const classification = this.classification(position);
    const parts = [
      classification?.type || position.positionType || 'Sin tipo',
      classification?.sector || position.sector || 'Sin sector',
      classification?.subsector || position.subsector || 'Sin subsector',
      classification?.region || position.region || 'Sin región'
    ];
    return parts.join(' · ');
  }

  expectedMetrics(position: PortfolioPosition): { hasTarget: boolean; expected: number; delta: number; deviation: number } {
    const expected = this.classification(position)?.expected ?? null;
    if (expected === null || expected === undefined || expected === 0) {
      return { hasTarget: false, expected: 0, delta: 0, deviation: 0 };
    }
    const delta = position.currentValue - expected;
    const deviation = (delta / expected) * 100;
    return { hasTarget: true, expected, delta, deviation };
  }

  operationsFor(symbol: string): InvestmentOperation[] {
    const key = symbol.toUpperCase();
    return [...this.operations]
      .filter((operation) => operation.symbol.toUpperCase() === key)
      .sort((a, b) => {
        const direction = this.operationSortDirection === 'asc' ? 1 : -1;
        return this.dateValue(a.date) > this.dateValue(b.date) ? direction : this.dateValue(a.date) < this.dateValue(b.date) ? -direction : 0;
      });
  }

  pagedOperations(symbol: string): InvestmentOperation[] {
    const operations = this.operationsFor(symbol);
    if (this.operationPageSize === 'all') {
      return operations;
    }
    const start = this.currentOperationPageIndex * this.operationPageSize;
    return operations.slice(start, start + this.operationPageSize);
  }

  operationPageCount(symbol: string): number {
    const operations = this.operationsFor(symbol);
    if (this.operationPageSize === 'all') {
      return 1;
    }
    return Math.max(1, Math.ceil(operations.length / this.operationPageSize));
  }

  get currentOperationPageIndex(): number {
    const max = Math.max(0, this.operationPageCount(this.symbol ?? '') - 1);
    return Math.min(this.operationPageIndex, max);
  }

  firstOperationPage(): void {
    this.operationPageIndex = 0;
  }

  previousOperationPage(): void {
    this.operationPageIndex = Math.max(0, this.currentOperationPageIndex - 1);
  }

  nextOperationPage(symbol: string): void {
    this.operationPageIndex = Math.min(this.operationPageCount(symbol) - 1, this.currentOperationPageIndex + 1);
  }

  lastOperationPage(symbol: string): void {
    this.operationPageIndex = this.operationPageCount(symbol) - 1;
  }

  totalQuantity(symbol: string): number {
    return this.operationsFor(symbol).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  }

  totalInvested(symbol: string): number {
    return this.operationsFor(symbol).reduce((sum, item) => sum + (item.total ?? item.amount ?? 0), 0);
  }

  totalCurrent(symbol: string): number {
    return this.operationsFor(symbol).reduce((sum, item) => sum + (item.currentValue ?? 0), 0);
  }

  weightedAveragePrice(symbol: string): number {
    const operations = this.operationsFor(symbol);
    const totalQuantity = operations.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const totalInvested = this.totalInvested(symbol);
    return totalQuantity > 0 ? totalInvested / totalQuantity : 0;
  }

  weightedReturn(symbol: string): string {
    const invested = this.totalInvested(symbol);
    const current = this.totalCurrent(symbol);
    return this.formatPercent(invested > 0 ? ((current - invested) / invested) * 100 : null);
  }

  operationResult(operation: InvestmentOperation): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const current = operation.currentValue ?? null;
    if (invested === null || current === null) {
      return null;
    }
    return current - invested;
  }

  operationResultPercent(operation: InvestmentOperation): number | null {
    const invested = operation.total ?? operation.amount ?? null;
    const result = this.operationResult(operation);
    if (invested === null || invested === 0 || result === null) {
      return null;
    }
    return (result / invested) * 100;
  }

  lotWeight(operation: InvestmentOperation): number {
    const symbol = operation.symbol.toUpperCase();
    const position = this.positionBySymbol(symbol);
    const totalCurrent = position?.currentValue ?? this.totalCurrent(symbol);
    const currentValue = operation.currentValue ?? 0;
    return totalCurrent > 0 ? (currentValue / totalCurrent) * 100 : 0;
  }

  manualAlerts(symbol: string): CombinedAlert[] {
    return this.alerts.filter((alert) => alert.group === 'manual' && alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  sortedManualAlerts(symbol: string): CombinedAlert[] {
    const rank = (status: string): number => {
      switch (status) {
        case 'activada':
          return 0;
        case 'cerca':
          return 1;
        case 'lejos':
          return 2;
        default:
          return 3;
      }
    };
    return [...this.manualAlerts(symbol)].sort((a, b) => rank(a.status) - rank(b.status) || Math.abs(a.distancePercent ?? Infinity) - Math.abs(b.distancePercent ?? Infinity));
  }

  calculatedAlerts(symbol: string): CombinedAlert[] {
    return this.alerts.filter((alert) => alert.group === 'calculated' && alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  signalAlerts(symbol: string): CombinedAlert[] {
    return this.alerts.filter((alert) => alert.group === 'signal' && alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  sortedSignalAlerts(symbol: string): CombinedAlert[] {
    return [...this.signalAlerts(symbol)].sort((a, b) => Math.abs(a.distancePercent ?? Infinity) - Math.abs(b.distancePercent ?? Infinity));
  }

  historicalSeries(symbol: string): Array<{ label: string; value: number; date?: string | null; changeAmount?: number | null; changePercent?: number | null }> {
    const ordered = this.filteredHistory(symbol);
    return ordered.map((item, index) => {
      const value = Number(item.price ?? 0);
      const previous = index > 0 ? Number(ordered[index - 1].price ?? 0) : null;
      return {
        label: this.formatDate(item.date),
        value,
        date: this.formatDate(item.date),
        changeAmount: previous !== null ? value - previous : null,
        changePercent: previous && previous !== 0 ? ((value - previous) / previous) * 100 : null
      };
    });
  }

  historyStats(symbol: string): { initial: number; final: number; variationAmount: number; variationPercent: number | null; startDate: string | null; endDate: string | null; max: number; maxDate: string | null; min: number; minDate: string | null; count: number } | null {
    const series = this.filteredHistory(symbol);
    if (!series.length) {
      return null;
    }
    const first = series[0];
    const last = series[series.length - 1];
    const values = series.map((item) => Number(item.price ?? 0));
    const initial = Number(first.price ?? 0);
    const final = Number(last.price ?? 0);
    const variationAmount = final - initial;
    return {
      initial,
      final,
      variationAmount,
      variationPercent: initial > 0 ? (variationAmount / initial) * 100 : null,
      startDate: this.formatDate(first.date),
      endDate: this.formatDate(last.date),
      max: Math.max(...values),
      maxDate: this.formatDate(series.find((item) => Number(item.price ?? 0) === Math.max(...values))?.date),
      min: Math.min(...values),
      minDate: this.formatDate(series.find((item) => Number(item.price ?? 0) === Math.min(...values))?.date),
      count: series.length
    };
  }

  private filteredHistory(symbol: string): HistoricalPrice[] {
    const ordered = this.historicalFor(symbol);
    switch (this.historyPeriod) {
      case '1M':
        return this.filterByPeriod(ordered, 1);
      case '3M':
        return this.filterByPeriod(ordered, 3);
      case '6M':
        return this.filterByPeriod(ordered, 6);
      case 'YTD':
        return this.filterByYtd(ordered);
      case '1Y':
        return this.filterByPeriod(ordered, 12);
      case 'CUSTOM':
      case 'ALL':
      default:
        return ordered;
    }
  }

  currencyTotal(currency: string): string {
    const normalized = this.currencyMapper.normalizeCurrency(currency);
    const total = this.positions
      .filter((position) => this.currencyMapper.normalizeCurrency(position.currency) === normalized)
      .reduce((sum, position) => sum + position.currentValue, 0);
    return this.formatMoney(total, currency);
  }

  weightFor(symbol: string): number {
    const position = this.positionBySymbol(symbol);
    if (!position) {
      return 0;
    }
    const totalByCurrency = this.positions
      .filter((item) => this.currencyMapper.normalizeCurrency(item.currency) === this.currencyMapper.normalizeCurrency(position.currency))
      .reduce((sum, item) => sum + item.currentValue, 0);
    return totalByCurrency > 0 ? (position.currentValue / totalByCurrency) * 100 : 0;
  }

  expectedDeviation(position: PortfolioPosition): string {
    const expected = this.classification(position)?.expected;
    if (!expected) {
      return 'Sin datos';
    }
    const deviation = ((position.currentValue - expected) / expected) * 100;
    return this.formatPercent(deviation);
  }

  classificationHelp(position: PortfolioPosition): string {
    const missing = this.missingClassification(position);
    if (missing === 'Sin faltantes') {
      return 'Clasificación completa.';
    }
    const notes: string[] = [];
    if (missing.includes('sector')) {
      notes.push('Falta sector en Tabla47. Eso agrupa la especie como "Sin sector" en los gráficos.');
    }
    if (missing.includes('subsector')) {
      notes.push('Falta subsector en Tabla47. Eso reduce el detalle de las categorías.');
    }
    if (missing.includes('región')) {
      notes.push('Falta región en Tabla47. Eso afecta los cortes geográficos.');
    }
    if (missing.includes('tipo activo')) {
      notes.push('Falta tipo activo. Eso afecta filtros y resumen por clase.');
    }
    return notes.join(' ');
  }

  formatDate(value: string | Date | null | undefined): string {
    if (!value) {
      return 'Sin datos';
    }
    const date = parseExcelDate(value);
    return date ? new Intl.DateTimeFormat('es-AR').format(date) : 'Sin datos';
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }

  formatMoney(value: number | null | undefined, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
  }

  formatPercent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  currencyLabel(currency: string): string {
    return this.currencyMapper.getCurrencyLabel(currency);
  }

  trackByOperationId(index: number, operation: InvestmentOperation): string {
    return operation.id || `${index}`;
  }

  private historicalFor(symbol: string): HistoricalPrice[] {
    const key = symbol.toUpperCase();
    return [...this.historicalPrices]
      .filter((item) => item.symbol.toUpperCase() === key && item.price !== null)
      .sort((a, b) => this.dateValue(a.date) - this.dateValue(b.date));
  }

  private filterByPeriod(series: HistoricalPrice[], monthsBack: number): HistoricalPrice[] {
    const lastDate = this.lastDate(series);
    if (!lastDate) {
      return series;
    }
    const start = new Date(lastDate);
    start.setMonth(start.getMonth() - monthsBack);
    return series.filter((item) => {
      const value = this.dateValue(item.date);
      return value >= start.getTime() && value <= lastDate.getTime();
    });
  }

  private filterByYtd(series: HistoricalPrice[]): HistoricalPrice[] {
    const lastDate = this.lastDate(series);
    if (!lastDate) {
      return series;
    }
    const start = new Date(lastDate.getFullYear(), 0, 1);
    return series.filter((item) => {
      const value = this.dateValue(item.date);
      return value >= start.getTime() && value <= lastDate.getTime();
    });
  }

  private lastDate(series: HistoricalPrice[]): Date | null {
    if (!series.length) {
      return null;
    }
    const last = series[series.length - 1]?.date;
    const parsed = parseExcelDate(last);
    return parsed;
  }

  private positionBySymbol(symbol: string): PortfolioPosition | null {
    const key = symbol.toUpperCase();
    return this.positions.find((position) => position.symbol.toUpperCase() === key) ?? null;
  }

  private dateValue(value: string | Date | null | undefined): number {
    if (!value) {
      return 0;
    }
    const date = parseExcelDate(value);
    return date ? date.getTime() : 0;
  }
}
