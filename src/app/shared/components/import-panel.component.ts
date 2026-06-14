import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-import-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="panel dropzone" [class.dragging]="dragging" (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
      <div class="title-row">
        <div>
          <p class="eyebrow">Importación local</p>
          <h2>Cargá tu archivo Excel</h2>
        </div>
        <button type="button" class="secondary" (click)="fileInput.click()">Elegir archivo</button>
      </div>
      <p class="helper">Procesa .xlsm o .xlsx localmente en el navegador. No se sube nada a un servidor.</p>
      <input #fileInput type="file" accept=".xlsx,.xlsm" hidden (change)="onFileSelected($event)">
      <div class="drop-hint">
        <strong>Arrastrá y soltá</strong>
        <span>o usá el botón para seleccionar <code>Historial Sueldo.xlsm</code></span>
      </div>
    </section>
  `,
  styles: [`
    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1.2rem;
    }
    .dropzone {
      min-height: 200px;
      display: grid;
      gap: 1rem;
      align-content: start;
      border-style: dashed;
    }
    .dragging {
      border-color: var(--brand);
      transform: translateY(-1px);
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }
    h2 {
      margin: 0.2rem 0 0;
      font-size: 1.4rem;
    }
    .eyebrow {
      margin: 0;
      color: var(--brand);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.76rem;
    }
    .helper {
      margin: 0;
      color: var(--muted);
    }
    .drop-hint {
      display: grid;
      gap: 0.3rem;
      align-content: center;
      justify-items: start;
      min-height: 100px;
      padding: 1rem;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
    }
    .secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--panel-border);
      color: var(--text);
      border-radius: 999px;
      padding: 0.7rem 1rem;
    }
    code {
      color: #d1f7f3;
    }
  `]
})
export class ImportPanelComponent {
  @Output() readonly fileSelected = new EventEmitter<File>();
  dragging = false;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }
}
