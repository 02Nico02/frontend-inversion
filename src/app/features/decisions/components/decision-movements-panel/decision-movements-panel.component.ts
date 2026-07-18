import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { parseExcelDate } from '../../../../core/utils/value-parsing.utils';
import { RecentMovementsSection } from '../../services/decision-dashboard.service';
import { MovementDateRange, MovementRangePreset } from '../../services/movement-date-range.service';

@Component({
  standalone: true,
  selector: 'app-decision-movements-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './decision-movements-panel.component.html',
  styleUrls: ['./decision-movements-panel.component.scss']
})
export class DecisionMovementsPanelComponent {
  @Input() movements: RecentMovementsSection | null = null;
  @Input() movementDateRange: MovementDateRange | null = null;
  @Input() privacyEnabled = false;
  @Input() movementPresets: Array<{ preset: MovementRangePreset; label: string }> = [];

  @Output() movementDateRangeChange = new EventEmitter<MovementDateRange>();
  @Output() presetSelected = new EventEmitter<MovementRangePreset>();

  trackBySummary(index: number): number {
    return index;
  }

  trackByRow(index: number): number {
    return index;
  }

  onDateChange(field: 'from' | 'to', value: string | null): void {
    if (!this.movementDateRange) {
      return;
    }
    this.movementDateRangeChange.emit({
      ...this.movementDateRange,
      [field]: this.inputDateToStoredDate(value),
      preset: 'custom'
    });
  }

  movementDateForInput(value: string | null | undefined): string | null {
    const parsed = parseExcelDate(value);
    if (!parsed) {
      return null;
    }
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private inputDateToStoredDate(value: string | null): string | null {
    const parsed = parseExcelDate(value);
    if (!parsed) {
      return null;
    }
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const year = parsed.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}
