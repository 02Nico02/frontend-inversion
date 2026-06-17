import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DecisionViewModel } from '../../services/decision-insights.service';

@Component({
  standalone: true,
  selector: 'app-decision-summary-panel',
  imports: [CommonModule],
  templateUrl: './decision-summary-panel.component.html',
  styleUrls: ['./decision-summary-panel.component.scss']
})
export class DecisionSummaryPanelComponent {
  @Input() dashboard: DecisionViewModel | null = null;
  @Input() currencyScope: 'ALL' | 'ARS' | 'USD' = 'ALL';

  trackByCard(index: number): number {
    return index;
  }

  trackByAction(index: number): number {
    return index;
  }

  trackByObjective(index: number): number {
    return index;
  }
}
