import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts-page.component.html',
  styleUrls: ['./alerts-page.component.scss'],
})
export class AlertsPageComponent {
  readonly groups = [
    { key: 'manual', label: 'Manuales' },
    { key: 'calculated', label: 'Calculadas' },
    { key: 'signal', label: 'Señales' }
  ] as const;

  constructor(public readonly state: PortfolioStateService) {}

  alertsByGroup(snapshot: PortfolioAppState, group: 'manual' | 'calculated' | 'signal') {
    return snapshot.combinedAlerts.filter((alert) => alert.group === group);
  }
}
