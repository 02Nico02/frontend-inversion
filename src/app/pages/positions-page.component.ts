import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PositionsTableComponent } from '../shared/components/positions-table.component';
import { AssetDetailDrawerComponent } from '../shared/components/asset-detail-drawer.component';
import { PortfolioAppState, PortfolioStateService } from '../core/services/portfolio-state.service';
import { PortfolioCalculatorService } from '../core/services/portfolio-calculator.service';

@Component({
  standalone: true,
  imports: [CommonModule, PositionsTableComponent, AssetDetailDrawerComponent],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Posiciones</p>
          <h2>Tabla operativa y detalle por especie</h2>
          <p class="lead">Filtrá, ordená y abrí el detalle lateral sin salir de la página.</p>
        </div>
      </header>

      <ng-container *ngIf="snapshot.dataset; else emptyState">
        <app-positions-table
          [positions]="visiblePositions(snapshot)"
          [alerts]="snapshot.combinedAlerts"
          (detailRequested)="openDetail($event)"
        ></app-positions-table>

        <app-asset-detail-drawer
          [open]="!!selectedDetailSymbol"
          [symbol]="selectedDetailSymbol"
          [positions]="visiblePositions(snapshot)"
          [operations]="snapshot.dataset.operations"
          [alerts]="snapshot.combinedAlerts"
          [historicalPrices]="snapshot.dataset.historicalPrices"
          [classifications]="snapshot.dataset.classifications"
          (close)="closeDetail()"
        ></app-asset-detail-drawer>
      </ng-container>

      <ng-template #emptyState>
        <article class="panel empty">
          <h3>No hay datos cargados</h3>
          <p>Importá el Excel para ver la tabla de posiciones.</p>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page {
      display: grid;
      gap: 1rem;
    }
    .page-header .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
    }
    .page-header h2 {
      margin: 0.2rem 0 0;
    }
    .lead {
      color: var(--muted);
      margin: 0.35rem 0 0;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1rem;
    }
  `]
})
export class PositionsPageComponent {
  selectedDetailSymbol: string | null = null;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly calculator: PortfolioCalculatorService
  ) {}

  visiblePositions(snapshot: PortfolioAppState) {
    return snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
  }

  openDetail(symbol: string): void {
    this.selectedDetailSymbol = symbol;
  }

  closeDetail(): void {
    this.selectedDetailSymbol = null;
  }
}
