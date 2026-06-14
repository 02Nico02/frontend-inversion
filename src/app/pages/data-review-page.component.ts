import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PortfolioAppState, PortfolioStateService } from '../core/services/portfolio-state.service';
import { PortfolioHealthService } from '../core/services/portfolio-health.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Datos a revisar</p>
          <h2>Salud del workbook y hallazgos</h2>
        </div>
      </header>

      <ng-container *ngIf="snapshot.dataset && snapshot.workbook; else emptyState">
        <div class="metrics">
          <article class="panel"><strong>Críticos</strong><span>{{ report(snapshot).summary.criticalProblems }}</span></article>
          <article class="panel"><strong>Advertencias</strong><span>{{ report(snapshot).summary.warnings }}</span></article>
          <article class="panel"><strong>Sin clasificación</strong><span>{{ report(snapshot).summary.uncategorizedAssets }}</span></article>
          <article class="panel"><strong>Sin histórico</strong><span>{{ report(snapshot).summary.assetsWithoutHistory }}</span></article>
        </div>

        <section class="panel list">
          <article class="card" *ngFor="let item of report(snapshot).findings | slice:0:30">
            <div class="head">
              <strong>{{ item.symbol || 'General' }}</strong>
              <span>{{ item.severity }}</span>
            </div>
            <p>{{ item.problem }}</p>
            <small>Fuente: {{ item.source }}</small>
            <small>Sugerencia: {{ item.suggestion }}</small>
          </article>
        </section>
      </ng-container>

      <ng-template #emptyState>
        <article class="panel">
          <h3>No hay datos cargados</h3>
          <p>Importá el Excel para ver los hallazgos.</p>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; }
    .page-header .eyebrow { margin: 0; color: var(--brand); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; }
    .page-header h2, .panel strong { margin: 0.2rem 0 0; }
    .panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1rem; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
    .metrics span { font-size: 1.2rem; font-weight: 700; }
    .list { display: grid; gap: 0.75rem; }
    .card { padding: 0.85rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--panel-border); display: grid; gap: 0.2rem; }
    .head { display: flex; justify-content: space-between; gap: 0.5rem; }
    @media (max-width: 900px) {
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
})
export class DataReviewPageComponent {
  constructor(public readonly state: PortfolioStateService, private readonly healthService: PortfolioHealthService) {}

  report(snapshot: PortfolioAppState) {
    return this.healthService.buildReport(snapshot.dataset!, snapshot.workbook!.validation);
  }
}
