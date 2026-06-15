import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PositionsTableComponent } from '../../../../shared/components/positions-table/positions-table.component';
import { AssetDetailDrawerComponent } from '../../../../shared/components/asset-detail-drawer/asset-detail-drawer.component';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';

@Component({
  standalone: true,
  imports: [CommonModule, PositionsTableComponent, AssetDetailDrawerComponent],
  templateUrl: './positions-page.component.html',
  styleUrls: ['./positions-page.component.scss'],
})
export class PositionsPageComponent {
  selectedDetailSymbol: string | null = null;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly calculator: PortfolioCalculatorService
  ) {}

  visiblePositions(snapshot: PortfolioAppState) {
    return snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
  }

  openDetail(symbol: string): void {
    this.selectedDetailSymbol = symbol;
  }

  closeDetail(): void {
    this.selectedDetailSymbol = null;
  }
}
