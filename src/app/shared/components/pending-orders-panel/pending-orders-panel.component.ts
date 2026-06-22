import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { PendingOrdersSummary } from '../../../core/models/pending-orders.model';

@Component({
  standalone: true,
  selector: 'app-pending-orders-panel',
  imports: [CommonModule],
  templateUrl: './pending-orders-panel.component.html',
  styleUrls: ['./pending-orders-panel.component.scss']
})
export class PendingOrdersPanelComponent {
  @Input() summary: PendingOrdersSummary | null = null;
  @Input() privacyEnabled = false;

  formatMoney(value: number | null | undefined): string {
    if (this.privacyEnabled) {
      return 'Oculto';
    }
    if (value === null || value === undefined) {
      return 'N/D';
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'N/D';
    }
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  trackByOrder(index: number, item: { symbol: string; quantity: number; limitPriceARS: number }): string {
    return `${index}-${item.symbol}-${item.quantity}-${item.limitPriceARS}`;
  }

  trackBySymbol(_index: number, item: { symbol: string }): string {
    return item.symbol;
  }
}
