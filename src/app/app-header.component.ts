import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { PortfolioStateService } from './core/services/portfolio-state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="app-header">
      <div class="brand">
        <p class="eyebrow">Finanzas Local</p>
        <div class="title-row">
          <h1>Panel financiero</h1>
          <span class="section-pill">{{ currentSection }}</span>
        </div>
        <p class="subtitle">Análisis financiero desde tu Excel</p>
      </div>

      <div class="file-state" *ngIf="state.snapshot as snapshot">
        <div class="state-row">
          <span class="status" [class.ready]="snapshot.status === 'ready'" [class.loading]="snapshot.status === 'loading'" [class.warning]="snapshot.status === 'warning'" [class.error]="snapshot.status === 'error'">{{ snapshot.status | titlecase }}</span>
          <strong>{{ snapshot.fileName || 'Sin archivo' }}</strong>
        </div>
        <small>{{ summaryText(snapshot) }}</small>
        <small *ngIf="snapshot.importedAt">Importado: {{ formatDate(snapshot.importedAt) }}</small>
      </div>

      <div class="actions">
        <a routerLink="/importacion" class="button">Cargar Excel</a>
        <button type="button" class="button ghost" (click)="goToValidation()">Ver validación</button>
        <button type="button" class="button ghost" (click)="clearImport()">Limpiar</button>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      position: sticky;
      top: 0;
      z-index: 20;
      display: grid;
      grid-template-columns: 1.2fr minmax(220px, 0.9fr) auto;
      gap: 1rem;
      align-items: center;
      padding: 0.9rem 1.2rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      background: rgba(6, 10, 22, 0.88);
      backdrop-filter: blur(14px);
    }
    .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.72rem;
    }
    .title-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0.15rem 0 0;
      font-size: 1.35rem;
    }
    .subtitle {
      margin: 0.2rem 0 0;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .section-pill {
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
      color: var(--text);
      font-size: 0.78rem;
    }
    .file-state {
      display: grid;
      gap: 0.15rem;
      color: var(--muted);
      justify-items: start;
    }
    .state-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .status {
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      border: 1px solid var(--panel-border);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .status.ready { color: var(--ok); }
    .status.loading { color: var(--warn); }
    .status.warning { color: #f59e0b; }
    .status.error { color: #fb7185; }
    .actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 0.9rem;
      border-radius: 999px;
      background: var(--brand);
      color: #06121b;
      border: 0;
      text-decoration: none;
      font-weight: 700;
    }
    .button.ghost {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      border: 1px solid var(--panel-border);
    }
    @media (max-width: 1100px) {
      .app-header {
        grid-template-columns: 1fr;
      }
      .actions {
        justify-content: flex-start;
      }
    }
  `]
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  currentSection = 'Resumen';
  private subscription?: Subscription;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.currentSection = this.sectionFromUrl(this.router.url);
    this.subscription = this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentSection = this.sectionFromUrl(event.urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  summaryText(snapshot: { status: string; workbook: { validation: { detectedTables: unknown[] } } | null; validationWarnings: string[]; validationErrors: string[] }): string {
    const tables = snapshot.workbook?.validation.detectedTables.length ?? 0;
    const warnings = snapshot.validationWarnings.length;
    const errors = snapshot.validationErrors.length;
    return `Workbook · ${tables} tablas detectadas · ${warnings} advertencias · ${errors} errores`;
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  goToValidation(): void {
    this.router.navigateByUrl('/datos-a-revisar');
  }

  clearImport(): void {
    this.state.reset();
    this.router.navigateByUrl('/importacion');
  }

  private sectionFromUrl(url: string): string {
    switch (url.split('?')[0]) {
      case '/distribucion': return 'Distribución';
      case '/posiciones': return 'Posiciones';
      case '/historico': return 'Histórico';
      case '/alertas': return 'Alertas';
      case '/concentracion': return 'Concentración';
      case '/estrategia': return 'Estrategia';
      case '/datos-a-revisar': return 'Datos a revisar';
      case '/importacion': return 'Importación';
      case '/configuracion': return 'Configuración';
      default: return 'Resumen';
    }
  }
}
