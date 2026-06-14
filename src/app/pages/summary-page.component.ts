import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardSummaryPanelComponent } from '../dashboard-summary-panel/dashboard-summary-panel.component';
import { PortfolioAppState, PortfolioStateService } from '../core/services/portfolio-state.service';
import { PortfolioHealthService } from '../core/services/portfolio-health.service';
import { PortfolioConcentrationService } from '../core/services/portfolio-concentration.service';
import { CurrencyMapperService } from '../core/services/currency-mapper.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, DashboardSummaryPanelComponent],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Resumen</p>
          <h2>Vista general del portafolio</h2>
          <p class="lead">Arranque rápido para entender el estado del Excel, la concentración y las alertas importantes.</p>
        </div>
      </header>

      <ng-container *ngIf="snapshot.dataset && snapshot.summary; else emptyState">
        <app-dashboard-summary-panel [summary]="snapshot.summary"></app-dashboard-summary-panel>

        <div class="mini-grid">
          <article class="panel">
            <p class="eyebrow">Salud de datos</p>
            <h3>{{ healthSummary(snapshot).status | titlecase }}</h3>
            <p>Críticos: {{ healthSummary(snapshot).criticalProblems }}</p>
            <p>Advertencias: {{ healthSummary(snapshot).warnings }}</p>
            <p>Sin clasificación: {{ healthSummary(snapshot).uncategorizedAssets }}</p>
          </article>

          <article class="panel">
            <p class="eyebrow">Concentración</p>
            <h3>{{ percent(concentration(snapshot).top1Percent) }} Top 1</h3>
            <p>{{ percent(concentration(snapshot).top3Percent) }} Top 3</p>
            <p>{{ percent(concentration(snapshot).top5Percent) }} Top 5</p>
            <a routerLink="/concentracion" class="link">Ver concentración</a>
          </article>

          <article class="panel">
            <p class="eyebrow">Alertas clave</p>
            <h3>{{ snapshot.combinedAlerts.length }} alertas</h3>
            <p *ngIf="snapshot.combinedAlerts[0] as alert">
              {{ alert.symbol }} · {{ alert.status }}
            </p>
            <a routerLink="/alertas" class="link">Abrir alertas</a>
          </article>

          <article class="panel">
            <p class="eyebrow">Acciones rápidas</p>
            <div class="action-list">
              <a routerLink="/importacion" class="link">Importar o reemplazar Excel</a>
              <a routerLink="/posiciones" class="link">Ir a posiciones</a>
              <a routerLink="/historico" class="link">Ver histórico</a>
              <a routerLink="/datos-a-revisar" class="link">Revisar datos</a>
            </div>
          </article>
        </div>
      </ng-container>

      <ng-template #emptyState>
        <article class="panel empty">
          <h3>No hay datos cargados</h3>
          <p>Cargá tu archivo <strong>Historial Sueldo.xlsm</strong> para ver el resumen general.</p>
          <a routerLink="/importacion" class="button">Cargar Excel</a>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page {
      display: grid;
      gap: 1rem;
    }
    .page-header .eyebrow,
    .panel .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
    }
    .page-header h2,
    .panel h3 {
      margin: 0.2rem 0 0;
    }
    .lead {
      color: var(--muted);
      margin: 0.35rem 0 0;
      max-width: 70ch;
    }
    .mini-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1rem;
      display: grid;
      gap: 0.4rem;
    }
    .link {
      color: var(--brand);
      text-decoration: none;
      font-weight: 700;
    }
    .button {
      display: inline-flex;
      padding: 0.6rem 0.9rem;
      border-radius: 999px;
      background: var(--brand);
      color: #06121b;
      text-decoration: none;
      font-weight: 700;
      width: fit-content;
    }
    .empty {
      justify-items: start;
    }
    .action-list {
      display: grid;
      gap: 0.35rem;
    }
    @media (max-width: 900px) {
      .mini-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SummaryPageComponent {
  constructor(
    public readonly state: PortfolioStateService,
    private readonly healthService: PortfolioHealthService,
    private readonly concentrationService: PortfolioConcentrationService,
    private readonly currencyMapper: CurrencyMapperService
  ) {}

  healthSummary(snapshot: PortfolioAppState) {
    return snapshot.dataset && snapshot.workbook ? this.healthService.buildReport(snapshot.dataset, snapshot.workbook.validation).summary : {
      criticalProblems: 0,
      warnings: 0,
      uncategorizedAssets: 0,
      assetsWithoutHistory: 0,
      alertsToReview: 0,
      incompleteSignals: 0,
      strategicSplitIssues: 0,
      status: 'ok' as const
    };
  }

  concentration(snapshot: PortfolioAppState) {
    const positions = snapshot.dataset?.positions ?? [];
    return this.concentrationService.buildReport(positions, 'ALL');
  }

  percent(value: number): string {
    return this.currencyMapper.formatPercentage(value);
  }
}
