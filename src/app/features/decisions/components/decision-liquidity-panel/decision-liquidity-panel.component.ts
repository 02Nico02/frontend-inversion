import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { LiquidityCard } from '../../services/decision-dashboard.service';

@Component({
  standalone: true,
  selector: 'app-decision-liquidity-panel',
  imports: [CommonModule],
  templateUrl: './decision-liquidity-panel.component.html',
  styleUrls: ['./decision-liquidity-panel.component.scss']
})
export class DecisionLiquidityPanelComponent {
  @Input() liquidity: LiquidityCard[] | null = null;
  @Input() privacyEnabled = false;

  trackByCard(index: number): number {
    return index;
  }
}
