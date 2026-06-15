import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { PortfolioSummary } from '../core/models/portfolio.models';
import { CurrencyMapperService } from '../core/services/currency-mapper.service';

@Component({
  selector: 'app-dashboard-summary-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-summary-panel.component.html',
  styleUrl: './dashboard-summary-panel.component.css'
})
export class DashboardSummaryPanelComponent {
  @Input() summary: PortfolioSummary | null = null;

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  currencyLabel(currency: string): string {
    return this.currencyMapper.getCurrencyLabel(currency);
  }

  formatMoney(value: number | null | undefined, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
  }

  formatNumber(value: number | null | undefined): string {
    return this.currencyMapper.formatNumber(value);
  }

  formatPercent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  formatDateLabel(value: string | Date | null | undefined): string {
    if (!value) {
      return 'N/D';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/D';
    }
    return new Intl.DateTimeFormat('es-AR').format(date);
  }
}
