import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { PerformanceReferenceBundle } from '../../services/performance-reference.service';

@Component({
  standalone: true,
  selector: 'app-decision-performance-panel',
  imports: [CommonModule],
  templateUrl: './decision-performance-panel.component.html',
  styleUrls: ['./decision-performance-panel.component.scss']
})
export class DecisionPerformancePanelComponent {
  @Input() performance: PerformanceReferenceBundle | null = null;
  @Input() privacyEnabled = false;

  trackByRow(index: number): number {
    return index;
  }
}
