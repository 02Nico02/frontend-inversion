import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PositionsTableComponent } from '../../../../shared/components/positions-table/positions-table.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';

@Component({
  standalone: true,
  imports: [CommonModule, PositionsTableComponent],
  templateUrl: './positions-page.component.html',
  styleUrls: ['./positions-page.component.scss'],
})
export class PositionsPageComponent {
  constructor(
    public readonly state: PortfolioStateService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly router: Router
  ) {}

  visiblePositions(snapshot: PortfolioAppState) {
    return snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
  }

  openDetail(symbol: string): void {
    this.router.navigate(['/posiciones', symbol]);
  }
}
