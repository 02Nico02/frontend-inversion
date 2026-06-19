import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { ActivatedAlertItem, DecisionActivatedAlerts } from '../../services/decision-opportunities.service';

@Component({
  standalone: true,
  selector: 'app-decision-activated-alerts',
  imports: [CommonModule, RouterLink],
  templateUrl: './decision-activated-alerts.component.html',
  styleUrls: ['./decision-activated-alerts.component.scss']
})
export class DecisionActivatedAlertsComponent {
  @Input() activatedAlerts: DecisionActivatedAlerts | null = null;
  @Input() privacyEnabled = false;

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  trackByItem(index: number, item: ActivatedAlertItem): string {
    return `${item.symbol}-${item.group}-${index}`;
  }

  formatMoney(value: number | null, currency: string): string {
    return this.privacyEnabled ? 'Oculto' : this.currencyMapper.formatCurrency(value, currency);
  }

  formatPercent(value: number | null): string {
    return this.privacyEnabled ? 'Oculto' : this.currencyMapper.formatPercentage(value);
  }

  groupLabel(group: string): string {
    switch (group) {
      case 'manual':
        return 'Manual';
      case 'calculated':
        return 'Calculada';
      default:
        return group;
    }
  }
}
