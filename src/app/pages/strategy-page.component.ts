import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PortfolioStateService } from '../core/services/portfolio-state.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Estrategia</p>
          <h2>Split estratégico y futura capa de objetivos</h2>
        </div>
      </header>

      <article class="panel" *ngIf="snapshot.dataset?.strategicSplit?.length; else emptyState">
        <h3>Tabla35 detectada</h3>
        <p>La estructura ya está preparada para comparar el split estratégico y revisar su escala, pero esta vista queda intencionalmente liviana por ahora.</p>
        <p>Más adelante se conectará con objetivos de portafolio y simulación de asignación.</p>
      </article>

      <ng-template #emptyState>
        <article class="panel">
          <h3>No hay split estratégico disponible</h3>
          <p>Si el workbook trae Tabla35, la futura vista de estrategia podrá usarla.</p>
        </article>
      </ng-template>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; }
    .page-header .eyebrow { margin: 0; color: var(--brand); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; }
    .page-header h2, .panel h3 { margin: 0.2rem 0 0; }
    .panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1rem; }
  `]
})
export class StrategyPageComponent {
  constructor(public readonly state: PortfolioStateService) {}
}

