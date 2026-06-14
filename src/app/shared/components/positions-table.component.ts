import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombinedAlert } from '../../core/services/alert-mapper.service';
import { CurrencyMapperService } from '../../core/services/currency-mapper.service';
import { PortfolioPosition } from '../../core/models/portfolio.models';

type SortField = 'symbol' | 'resultAmount' | 'resultPercent' | 'currentValue' | 'portfolioWeight';
type SortDirection = 'asc' | 'desc';
type PageSize = 10 | 25 | 50 | 'all';

@Component({
  selector: 'app-positions-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="panel">
      <div class="title-row">
        <div>
          <p class="eyebrow">Posiciones</p>
          <h3>Tabla operativa de posiciones</h3>
        </div>
        <div class="header-actions">
          <div class="summary-chip" *ngIf="filteredPositions.length">
            {{ filteredPositions.length }} posiciones filtradas
          </div>
          <button type="button" class="clear" (click)="clearFilters()">Limpiar filtros</button>
        </div>
      </div>

      <div class="filters">
        <label>
          <span>Buscar especie</span>
          <input [(ngModel)]="filters.symbol" [attr.list]="symbolListId" placeholder="AAPL, AMD, BTC..." />
        </label>
        <label>
          <span>Moneda</span>
          <select [(ngModel)]="filters.currency">
            <option value="">Todas</option>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="UNKNOWN">Sin moneda</option>
          </select>
        </label>
        <label>
          <span>Tipo de activo</span>
          <input [(ngModel)]="filters.assetType" [attr.list]="assetTypeListId" placeholder="FCI, BONO, ACCION..." />
        </label>
        <label>
          <span>Sector</span>
          <input [(ngModel)]="filters.sector" [attr.list]="sectorListId" placeholder="Tecnología, Energía..." />
        </label>
        <label>
          <span>Subsector</span>
          <input [(ngModel)]="filters.subsector" [attr.list]="subsectorListId" placeholder="Oro ETF, Cloud..." />
        </label>
        <label>
          <span>Región</span>
          <input [(ngModel)]="filters.region" [attr.list]="regionListId" placeholder="USA, Argentina..." />
        </label>
        <label>
          <span>Resultado</span>
          <select [(ngModel)]="filters.resultDirection">
            <option value="all">Todos</option>
            <option value="positive">Positivos</option>
            <option value="negative">Negativos</option>
          </select>
        </label>
        <label>
          <span>Alertas</span>
          <select [(ngModel)]="filters.alerts">
            <option value="all">Todas</option>
            <option value="with">Con alertas</option>
            <option value="without">Sin alertas</option>
          </select>
        </label>
        <label>
          <span>Clasificación</span>
          <select [(ngModel)]="filters.classification">
            <option value="all">Todas</option>
            <option value="with">Con clasificación</option>
            <option value="without">Sin clasificación</option>
          </select>
        </label>
        <label>
          <span>Orden</span>
          <select [(ngModel)]="sortField">
            <option value="symbol">Especie</option>
            <option value="currentValue">Total actual</option>
            <option value="resultAmount">Resultado</option>
            <option value="resultPercent">Resultado %</option>
            <option value="portfolioWeight">Peso</option>
          </select>
        </label>
        <label>
          <span>Dirección</span>
          <select [(ngModel)]="sortDirection">
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </label>
        <label>
          <span>Filas</span>
          <select [(ngModel)]="pageSize">
            <option [ngValue]="10">10</option>
            <option [ngValue]="25">25</option>
            <option [ngValue]="50">50</option>
            <option [ngValue]="'all'">Todas</option>
          </select>
        </label>
      </div>

      <div class="pager" *ngIf="pageCount > 1">
        <span>Página {{ currentPageIndex + 1 }} de {{ pageCount }}</span>
        <div class="pager-actions">
          <button type="button" (click)="firstPage()" [disabled]="currentPageIndex === 0">Primera</button>
          <button type="button" (click)="previousPage()" [disabled]="currentPageIndex === 0">Anterior</button>
          <button type="button" (click)="nextPage()" [disabled]="currentPageIndex >= pageCount - 1">Siguiente</button>
          <button type="button" (click)="lastPage()" [disabled]="currentPageIndex >= pageCount - 1">Última</button>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="sticky-col">Especie</th>
              <th>Moneda</th>
              <th class="num">Cantidad</th>
              <th class="num">Precio prom.</th>
              <th class="num">Precio act.</th>
              <th class="num">Total inv.</th>
              <th class="num">Total actual</th>
              <th class="num">Resultado $</th>
              <th class="num">Resultado %</th>
              <th class="num">Peso %</th>
              <th class="num">Alertas</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let position of pagedPositions; trackBy: trackBySymbol" (click)="requestDetail(position.symbol)">
              <td class="sticky-col clickable">
                <strong>{{ position.symbol }}</strong>
              </td>
              <td>{{ currencyLabel(position.currency) }}</td>
              <td class="num">{{ formatNumber(position.quantity) }}</td>
              <td class="num">{{ formatMoney(position.averagePrice, position.currency) }}</td>
              <td class="num">{{ formatMoney(position.currentPrice, position.currency) }}</td>
              <td class="num">{{ formatMoney(position.totalInvested, position.currency) }}</td>
              <td class="num">{{ formatMoney(position.currentValue, position.currency) }}</td>
              <td class="num" [class.positive]="position.resultAmount > 0" [class.negative]="position.resultAmount < 0">{{ formatMoney(position.resultAmount, position.currency) }}</td>
              <td class="num" [class.positive]="(position.resultPercent ?? 0) > 0" [class.negative]="(position.resultPercent ?? 0) < 0">{{ formatPercent(position.resultPercent) }}</td>
              <td class="num">{{ formatPercent(weightFor(position)) }}</td>
              <td class="num">
                <span class="alert-pill" [class.alerted]="hasAlert(position.symbol)">{{ alertCount(position.symbol) }}</span>
              </td>
              <td>
                <button type="button" class="toggle" (click)="requestDetail(position.symbol); $event.stopPropagation()">Detalle</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <datalist [id]="symbolListId">
        <option *ngFor="let option of symbolOptions" [value]="option"></option>
      </datalist>
      <datalist [id]="assetTypeListId">
        <option *ngFor="let option of assetTypeOptions" [value]="option"></option>
      </datalist>
      <datalist [id]="sectorListId">
        <option *ngFor="let option of sectorOptions" [value]="option"></option>
      </datalist>
      <datalist [id]="subsectorListId">
        <option *ngFor="let option of subsectorOptions" [value]="option"></option>
      </datalist>
      <datalist [id]="regionListId">
        <option *ngFor="let option of regionOptions" [value]="option"></option>
      </datalist>
    </section>
  `,
  styles: [`
    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1.2rem;
      display: grid;
      gap: 1rem;
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }
    .header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.76rem;
    }
    h3 { margin: 0.2rem 0 0; }
    .summary-chip {
      padding: 0.55rem 0.8rem;
      border-radius: 999px;
      border: 1px solid var(--panel-border);
      color: var(--muted);
      background: rgba(255, 255, 255, 0.04);
      font-size: 0.85rem;
    }
    .clear, .pager-actions button, .toggle {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: var(--text);
      border-radius: 10px;
      padding: 0.45rem 0.7rem;
    }
    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .filters label {
      display: grid;
      gap: 0.3rem;
      color: var(--muted);
      font-size: 0.8rem;
    }
    .filters input,
    .filters select {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 0.7rem 0.8rem;
    }
    .pager {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .pager-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .table-wrap {
      overflow: auto;
      border-radius: var(--radius-sm);
      border: 1px solid var(--panel-border);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1300px;
    }
    th, td {
      padding: 0.8rem 0.9rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      vertical-align: top;
      white-space: nowrap;
    }
    td { text-align: left; }
    th {
      position: sticky;
      top: 0;
      background: #121b35;
      color: var(--muted);
      font-weight: 600;
      z-index: 2;
    }
    .sticky-col {
      position: sticky;
      left: 0;
      background: #121b35;
      z-index: 3;
    }
    .clickable {
      cursor: pointer;
    }
    .num { text-align: right; }
    tbody tr:hover td {
      background: rgba(255, 255, 255, 0.03);
    }
    tbody tr:hover .sticky-col {
      background: #182041;
    }
    .alert-pill {
      display: inline-block;
      border-radius: 999px;
      padding: 0.25rem 0.6rem;
      border: 1px solid var(--panel-border);
      color: var(--muted);
      font-size: 0.78rem;
    }
    .alert-pill.alerted {
      color: var(--warn);
      border-color: rgba(245, 158, 11, 0.35);
    }
    .positive { color: var(--ok); }
    .negative { color: #fb7185; }
    @media (max-width: 1100px) {
      .title-row {
        flex-direction: column;
      }
    }
  `]
})
export class PositionsTableComponent {
  @Input() positions: PortfolioPosition[] = [];
  @Input() alerts: CombinedAlert[] = [];
  @Output() detailRequested = new EventEmitter<string>();

  filters = {
    symbol: '',
    currency: '',
    assetType: '',
    sector: '',
    subsector: '',
    region: '',
    resultDirection: 'all',
    alerts: 'all',
    classification: 'all'
  };

  sortField: SortField = 'currentValue';
  sortDirection: SortDirection = 'desc';
  pageSize: PageSize = 10;
  pageIndex = 0;

  readonly symbolListId = 'position-symbol-list';
  readonly assetTypeListId = 'position-asset-type-list';
  readonly sectorListId = 'position-sector-list';
  readonly subsectorListId = 'position-subsector-list';
  readonly regionListId = 'position-region-list';

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  get filteredPositions(): PortfolioPosition[] {
    return this.positions
      .filter((position) => {
        const symbol = position.symbol.toLowerCase();
        const sector = (position.classification?.sector || position.sector || '').toLowerCase();
        const subsector = (position.classification?.subsector || position.subsector || '').toLowerCase();
        const region = (position.classification?.region || position.region || '').toLowerCase();
        const assetType = (position.assetType || '').toLowerCase();
        const currency = this.currencyMapper.normalizeCurrency(position.currency);
        const hasClassification = Boolean(position.classification);
        const hasAlerts = this.hasAlert(position.symbol);
        const resultPositive = (position.resultAmount ?? 0) >= 0;

        return (
          (!this.filters.symbol || symbol.includes(this.filters.symbol.toLowerCase())) &&
          (!this.filters.currency || currency === this.filters.currency) &&
          (!this.filters.assetType || assetType.includes(this.filters.assetType.toLowerCase())) &&
          (!this.filters.sector || sector.includes(this.filters.sector.toLowerCase())) &&
          (!this.filters.subsector || subsector.includes(this.filters.subsector.toLowerCase())) &&
          (!this.filters.region || region.includes(this.filters.region.toLowerCase())) &&
          (this.filters.resultDirection === 'all' ||
            (this.filters.resultDirection === 'positive' && resultPositive) ||
            (this.filters.resultDirection === 'negative' && !resultPositive)) &&
          (this.filters.alerts === 'all' ||
            (this.filters.alerts === 'with' && hasAlerts) ||
            (this.filters.alerts === 'without' && !hasAlerts)) &&
          (this.filters.classification === 'all' ||
            (this.filters.classification === 'with' && hasClassification) ||
            (this.filters.classification === 'without' && !hasClassification))
        );
      })
      .sort((a, b) => {
        const direction = this.sortDirection === 'asc' ? 1 : -1;
        const aValue = this.sortValue(a);
        const bValue = this.sortValue(b);
        return aValue > bValue ? direction : aValue < bValue ? -direction : 0;
      });
  }

  get pageCount(): number {
    if (this.pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(this.filteredPositions.length / this.pageSize));
  }

  get currentPageIndex(): number {
    return Math.min(this.pageIndex, this.pageCount - 1);
  }

  get pagedPositions(): PortfolioPosition[] {
    if (this.pageSize === 'all') {
      return this.filteredPositions;
    }
    const start = this.currentPageIndex * this.pageSize;
    return this.filteredPositions.slice(start, start + this.pageSize);
  }

  get symbolOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.symbol));
  }

  get assetTypeOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.assetType ?? ''));
  }

  get sectorOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.classification?.sector || position.sector || ''));
  }

  get subsectorOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.classification?.subsector || position.subsector || ''));
  }

  get regionOptions(): string[] {
    return this.uniqueValues(this.positions.map((position) => position.classification?.region || position.region || ''));
  }

  requestDetail(symbol: string): void {
    this.detailRequested.emit(symbol);
  }

  weightFor(position: PortfolioPosition): number {
    const currency = this.currencyMapper.normalizeCurrency(position.currency);
    const totalByCurrency = this.positions
      .filter((item) => this.currencyMapper.normalizeCurrency(item.currency) === currency)
      .reduce((sum, item) => sum + item.currentValue, 0);
    return totalByCurrency > 0 ? (position.currentValue / totalByCurrency) * 100 : 0;
  }

  hasAlert(symbol: string): boolean {
    return this.alerts.some((alert) => alert.symbol.toUpperCase() === symbol.toUpperCase());
  }

  alertCount(symbol: string): string {
    const count = this.alerts.filter((alert) => alert.symbol.toUpperCase() === symbol.toUpperCase()).length;
    return count ? `${count}` : '0';
  }

  clearFilters(): void {
    this.filters = {
      symbol: '',
      currency: '',
      assetType: '',
      sector: '',
      subsector: '',
      region: '',
      resultDirection: 'all',
      alerts: 'all',
      classification: 'all'
    };
    this.sortField = 'currentValue';
    this.sortDirection = 'desc';
    this.pageSize = 10;
    this.pageIndex = 0;
  }

  firstPage(): void {
    this.pageIndex = 0;
  }

  previousPage(): void {
    this.pageIndex = Math.max(0, this.currentPageIndex - 1);
  }

  nextPage(): void {
    this.pageIndex = Math.min(this.pageCount - 1, this.currentPageIndex + 1);
  }

  lastPage(): void {
    this.pageIndex = this.pageCount - 1;
  }

  currencyLabel(currency: string): string {
    return this.currencyMapper.getCurrencyLabel(currency);
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

  trackBySymbol(index: number, position: PortfolioPosition): string {
    return position.symbol || `${index}`;
  }

  private sortValue(position: PortfolioPosition): string | number {
    switch (this.sortField) {
      case 'symbol':
        return position.symbol;
      case 'resultAmount':
        return position.resultAmount;
      case 'resultPercent':
        return position.resultPercent ?? -Infinity;
      case 'portfolioWeight':
        return position.portfolioWeight ?? -Infinity;
      case 'currentValue':
      default:
        return position.currentValue;
    }
  }

  private uniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
  }
}
