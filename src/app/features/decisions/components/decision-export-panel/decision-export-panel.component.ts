import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportFormat, ExportMode, WeeklyManualContext } from '../../services/gpt-portfolio-export.service';

@Component({
  standalone: true,
  selector: 'app-decision-export-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './decision-export-panel.component.html',
  styleUrls: ['./decision-export-panel.component.scss']
})
export class DecisionExportPanelComponent {
  @Input() exportMode: ExportMode = 'summary';
  @Input() exportFormat: ExportFormat = 'markdown';
  @Input() includeFullPurchases = false;
  @Input() includeMonthlyHistory = true;
  @Input() includeSignals = true;
  @Input() includeDataReview = true;
  @Input() includeSimulation = false;
  @Input() maskSensitiveExports = false;
  @Input() privacyEnabled = false;
  @Input() weeklyContext: WeeklyManualContext | null = null;
  @Input() rangeLabel = 'N/D';
  @Input() rangePresetLabel = 'N/D';

  @Output() exportModeChange = new EventEmitter<ExportMode>();
  @Output() exportFormatChange = new EventEmitter<ExportFormat>();
  @Output() includeFullPurchasesChange = new EventEmitter<boolean>();
  @Output() includeMonthlyHistoryChange = new EventEmitter<boolean>();
  @Output() includeSignalsChange = new EventEmitter<boolean>();
  @Output() includeDataReviewChange = new EventEmitter<boolean>();
  @Output() includeSimulationChange = new EventEmitter<boolean>();
  @Output() maskSensitiveExportsChange = new EventEmitter<boolean>();
  @Output() cashArsChange = new EventEmitter<number | null>();
  @Output() cashUsdChange = new EventEmitter<number | null>();
  @Output() clearCash = new EventEmitter<void>();
  @Output() copyExport = new EventEmitter<void>();
  @Output() downloadExport = new EventEmitter<void>();

  emitCash(output: EventEmitter<number | null>, value: unknown): void {
    if (value === null || value === undefined || value === '') {
      output.emit(null);
      return;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    output.emit(Number.isFinite(parsed) ? parsed : null);
  }
}
