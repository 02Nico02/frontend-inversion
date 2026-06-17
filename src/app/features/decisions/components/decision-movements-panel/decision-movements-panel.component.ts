import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
      [field]: value || null,
      preset: 'custom'
    });
  }
}
