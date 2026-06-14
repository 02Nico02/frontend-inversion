import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PortfolioAppState, PortfolioStateService } from '../core/services/portfolio-state.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Alertas</p>
          <h2>Alertas manuales, calculadas y señales</h2>
        </div>
      </header>

      <ng-container *ngIf="snapshot.combinedAlerts.length; else emptyState">
        <section class="panel" *ngFor="let group of groups">
          <h3>{{ group.label }}</h3>
          <div class="grid">
            <article class="card" *ngFor="let alert of alertsByGroup(snapshot, group.key)">
              <strong>{{ alert.symbol }}</strong>
              <span>{{ alert.status }}</span>
              <small>Actual: {{ alert.currentPrice ?? 'N/D' }}</small>
              <small>Objetivo: {{ alert.targetPrice ?? 'N/D' }}</small>
              <small>Distancia: {{ alert.distancePercent ?? 'N/D' }}</small>
            </article>
          </div>
        </section>
      </ng-container>

      <ng-template #emptyState>
        <article class="panel">
          <h3>No hay alertas</h3>
          <p>Importá el Excel para ver las alertas y señales.</p>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; }
    .page-header .eyebrow { margin: 0; color: var(--brand); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; }
    .page-header h2, .panel h3 { margin: 0.2rem 0 0; }
    .panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1rem; display: grid; gap: 0.9rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
    .card { padding: 0.85rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--panel-border); display: grid; gap: 0.2rem; }
  `]
})
export class AlertsPageComponent {
  readonly groups = [
    { key: 'manual', label: 'Manuales' },
    { key: 'calculated', label: 'Calculadas' },
    { key: 'signal', label: 'Señales' }
  ] as const;

  constructor(public readonly state: PortfolioStateService) {}

  alertsByGroup(snapshot: PortfolioAppState, group: 'manual' | 'calculated' | 'signal') {
    return snapshot.combinedAlerts.filter((alert) => alert.group === group);
  }
}
