import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strategy-page.component.html',
  styleUrls: ['./strategy-page.component.scss'],
})
export class StrategyPageComponent {
  constructor(public readonly state: PortfolioStateService) {}
}

