import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SimpleChartComponent } from '../../../../shared/components/simple-chart/simple-chart.component';
import { SimulationRateMode } from '../../services/decision-dashboard.service';
import { PerformanceReferenceBundle } from '../../services/performance-reference.service';

@Component({
  standalone: true,
  selector: 'app-decision-simulator-panel',
  imports: [CommonModule, FormsModule, SimpleChartComponent],
  templateUrl: './decision-simulator-panel.component.html',
  styleUrls: ['./decision-simulator-panel.component.scss']
})
export class DecisionSimulatorPanelComponent {
  @Input() simulation: any | null = null;
  @Input() simulationCurrency: 'ARS' | 'USD' = 'ARS';
  @Input() monthlyContribution = 0;
  @Input() months = 0;
  @Input() annualReturnPercent = 0;
  @Input() simulationRateMode: SimulationRateMode = 'real12m';
  @Input() performanceReferences: PerformanceReferenceBundle | null = null;
  @Input() privacyEnabled = false;

  @Output() simulationCurrencyChange = new EventEmitter<'ARS' | 'USD'>();
  @Output() monthlyContributionChange = new EventEmitter<number>();
  @Output() monthsChange = new EventEmitter<number>();
  @Output() annualReturnPercentChange = new EventEmitter<number>();
  @Output() simulationRateModeChange = new EventEmitter<SimulationRateMode>();

  emitNumber(output: EventEmitter<number>, value: unknown): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    output.emit(Number.isFinite(parsed) ? parsed : 0);
  }
}
