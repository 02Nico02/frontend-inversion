import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecisionSignalSummary } from '../../services/decision-insights.service';

@Component({
  standalone: true,
  selector: 'app-decision-signals-summary',
  imports: [CommonModule, RouterLink],
  templateUrl: './decision-signals-summary.component.html',
  styleUrls: ['./decision-signals-summary.component.scss']
})
export class DecisionSignalsSummaryComponent {
  @Input() signalsSummary: DecisionSignalSummary | null = null;
}
