import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { DecisionMisleadingPositionsReview, MisleadingPositionItem } from '../../services/decision-opportunities.service';

@Component({
  standalone: true,
  selector: 'app-decision-misleading-positions',
  imports: [CommonModule, RouterLink],
  templateUrl: './decision-misleading-positions.component.html',
  styleUrls: ['./decision-misleading-positions.component.scss']
})
export class DecisionMisleadingPositionsComponent {
  @Input() review: DecisionMisleadingPositionsReview | null = null;
  @Input() privacyEnabled = false;

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  trackByItem(index: number, item: MisleadingPositionItem): string {
    return `${item.symbol}-${index}`;
  }

  formatMoney(value: number | null, currency: string): string {
    return this.privacyEnabled ? 'Oculto' : this.currencyMapper.formatCurrency(value, currency);
  }

  formatPercent(value: number | null): string {
    return this.privacyEnabled ? 'Oculto' : this.currencyMapper.formatPercentage(value);
  }
}
