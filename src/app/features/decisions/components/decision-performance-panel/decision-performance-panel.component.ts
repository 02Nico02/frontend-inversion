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

  referenceSourceLabel(source: string): string {
    const normalized = source.trim().toLowerCase();
    if (!normalized) {
      return 'Referencia';
    }
    if (normalized.includes('tablacalendario')) {
      return 'Calendario histórico';
    }
    if (normalized.includes('historialmensualreconstruido')) {
      return 'Histórico mensual del portafolio';
    }
    if (normalized.includes('portfolio') || normalized.includes('recalculado')) {
      return 'Referencia recalculada';
    }
    return 'Referencia histórica';
  }
}

