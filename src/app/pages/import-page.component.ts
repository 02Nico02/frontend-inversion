import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ImportPanelComponent } from '../shared/components/import-panel.component';
import { ValidationSummaryComponent } from '../shared/components/validation-summary.component';
import { PortfolioStateService } from '../core/services/portfolio-state.service';
import { PortfolioImportService } from '../core/services/portfolio-import.service';

@Component({
  standalone: true,
  imports: [CommonModule, ImportPanelComponent, ValidationSummaryComponent],
  template: `
    <section class="page" *ngIf="state.snapshot as snapshot">
      <header class="page-header">
        <div>
          <p class="eyebrow">Importación</p>
          <h2>Cargar o reemplazar Excel</h2>
        </div>
      </header>

      <app-import-panel (fileSelected)="handleFile($event)"></app-import-panel>
      <app-validation-summary [report]="snapshot.workbook?.validation || null"></app-validation-summary>

      <article class="panel" *ngIf="snapshot.workbook">
        <h3>Workbook</h3>
        <p>Archivo: {{ snapshot.fileName || 'N/D' }}</p>
        <p>Tablas detectadas: {{ snapshot.workbook.validation.detectedTables.length }}</p>
        <p>Estado: {{ snapshot.status }}</p>
      </article>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; }
    .page-header .eyebrow { margin: 0; color: var(--brand); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; }
    .page-header h2, .panel h3 { margin: 0.2rem 0 0; }
    .panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1rem; }
  `]
})
export class ImportPageComponent {
  constructor(
    public readonly state: PortfolioStateService,
    private readonly router: Router,
    private readonly importService: PortfolioImportService
  ) {}

  async handleFile(file: File): Promise<void> {
    const imported = await this.importService.importFile(file);
    if (imported) {
      this.router.navigateByUrl('/resumen');
    }
  }
}
