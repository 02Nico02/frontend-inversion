import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkbookValidationReport } from '../../core/models/workbook.models';

@Component({
  selector: 'app-validation-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <details class="panel" *ngIf="report">
      <summary class="header">
        <div>
          <p class="eyebrow">Validación</p>
          <h3>Resumen del archivo</h3>
        </div>
        <div class="status" [class.ok]="!report.errors.length" [class.warn]="report.warnings.length > 0">
          {{ report.errors.length ? 'Con errores' : report.warnings.length ? 'Con advertencias' : 'OK' }}
        </div>
      </summary>

      <div class="meta">
        <span>Hojas: {{ report.sheetNames.length }}</span>
        <span>Tablas: {{ report.detectedTables.length }}</span>
        <span>Errores: {{ report.errors.length }}</span>
        <span>Advertencias: {{ report.warnings.length }}</span>
      </div>

      <div class="grid">
        <article *ngFor="let finding of report.findings" class="card" [class.critical]="finding.critical" [class.missing]="!finding.found">
          <header>
            <strong>{{ finding.name }}</strong>
            <span class="pill" [class.error]="finding.severity === 'error'" [class.warning]="finding.severity === 'warning'">
              {{ finding.found ? finding.rowCount + ' filas' : 'No encontrada' }}
            </span>
          </header>
          <p>{{ finding.sheetName || 'Sin hoja asociada' }}</p>
          <small>Columnas: {{ finding.detectedColumns.join(', ') || 'ninguna' }}</small>
          <small *ngIf="finding.missingColumns.length">Faltantes: {{ finding.missingColumns.join(', ') }}</small>
        </article>
      </div>

      <div class="lists">
        <div>
          <h4>Problemas detectados</h4>
          <ul>
            <li *ngFor="let item of report.errors">{{ item }}</li>
            <li *ngIf="!report.errors.length">Sin errores críticos.</li>
          </ul>
        </div>
        <div>
          <h4>Advertencias</h4>
          <ul>
            <li *ngFor="let item of report.warnings">{{ item }}</li>
            <li *ngIf="!report.warnings.length">Sin advertencias relevantes.</li>
          </ul>
        </div>
      </div>

      <div class="lists details">
        <div>
          <h4>Datos inválidos</h4>
          <ul>
            <li *ngFor="let item of report.invalidDates">Fecha inválida: {{ item }}</li>
            <li *ngIf="!report.invalidDates.length">Sin fechas inválidas detectadas.</li>
          </ul>
        </div>
        <div>
          <h4>Números y monedas</h4>
          <ul>
            <li *ngFor="let item of report.invalidNumbers">Número inválido: {{ item }}</li>
            <li *ngIf="!report.invalidNumbers.length">Sin números inválidos detectados.</li>
            <li *ngFor="let item of report.currencyIssues">Moneda no reconocida: {{ item.currency }} ({{ item.count }} filas)</li>
            <li *ngIf="!report.currencyIssues.length">Monedas detectadas correctamente: ARS, USD.</li>
          </ul>
        </div>
        <div>
          <h4>Especies a revisar</h4>
          <ul>
            <li *ngFor="let item of report.uncategorizedSymbols">Sin clasificación: {{ item }}</li>
            <li *ngIf="!report.uncategorizedSymbols.length">Sin especies sin clasificación.</li>
            <li *ngFor="let item of report.symbolsWithoutHistory">Sin historial: {{ item }}</li>
            <li *ngIf="!report.symbolsWithoutHistory.length">Sin especies sin historial.</li>
            <li *ngFor="let item of report.symbolsWithoutCurrentPrice">Sin precio actual: {{ item }}</li>
            <li *ngIf="!report.symbolsWithoutCurrentPrice.length">Sin alertas sin precio actual.</li>
          </ul>
        </div>
      </div>
    </details>
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
    .header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      cursor: pointer;
      list-style: none;
    }
    .header::-webkit-details-marker {
      display: none;
    }
    .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.76rem;
    }
    h3, h4, p {
      margin: 0;
    }
    .status, .pill {
      border-radius: 999px;
      padding: 0.35rem 0.7rem;
      font-size: 0.8rem;
      border: 1px solid var(--panel-border);
      color: var(--muted);
    }
    .status.ok {
      color: var(--ok);
    }
    .status.warn {
      color: var(--warn);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 0.8rem;
    }
    .card {
      padding: 0.9rem;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--panel-border);
      display: grid;
      gap: 0.45rem;
    }
    .card.missing {
      border-color: rgba(239, 68, 68, 0.45);
    }
    .card.critical {
      background: rgba(239, 68, 68, 0.05);
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }
    small {
      color: var(--muted);
    }
    .lists {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    .details {
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    ul {
      margin: 0.5rem 0 0;
      padding-left: 1rem;
      color: var(--muted);
    }
    .pill.error {
      color: var(--bad);
    }
    .pill.warning {
      color: var(--warn);
    }
  `]
})
export class ValidationSummaryComponent {
  @Input() report: WorkbookValidationReport | null = null;
}
