import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { DecisionMinimumBenchmarkReview, MinimumBenchmarkReviewItem } from '../../services/decision-opportunities.service';

@Component({
  standalone: true,
  selector: 'app-decision-minimum-benchmark-review',
  imports: [CommonModule, RouterLink],
  templateUrl: './decision-minimum-benchmark-review.component.html',
  styleUrls: ['./decision-minimum-benchmark-review.component.scss']
})
export class DecisionMinimumBenchmarkReviewComponent {
  @Input() review: DecisionMinimumBenchmarkReview | null = null;
  @Input() privacyEnabled = false;

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  trackByItem(index: number, item: MinimumBenchmarkReviewItem): string {
    return `${item.symbol}-${index}`;
  }

  formatMoney(value: number | null, currency: string): string {
    return this.privacyEnabled ? 'Oculto' : this.currencyMapper.formatCurrency(value, currency);
  }

  formatPercent(value: number | null): string {
    return this.privacyEnabled ? 'Oculto' : this.currencyMapper.formatPercentage(value);
  }

  totalDeficitLabel(value: number): string {
    return this.privacyEnabled ? 'Oculto' : this.currencyMapper.formatCurrency(value, 'ARS');
  }
}
