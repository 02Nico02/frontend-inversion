import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PositionsTableComponent } from '../../../../shared/components/positions-table/positions-table.component';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { MinimumPerformanceBySymbol } from '../../../../core/models/minimum-performance.model';
import { MinimumPerformanceService } from '../../../../core/services/minimum-performance.service';
import { PortfolioPosition } from '../../../../core/models/portfolio.models';

@Component({
  standalone: true,
  imports: [CommonModule, PositionsTableComponent],
  templateUrl: './positions-page.component.html',
  styleUrls: ['./positions-page.component.scss'],
})
export class PositionsPageComponent implements OnInit, OnDestroy {
  positions: PortfolioPosition[] = [];
  minimumPerformance: MinimumPerformanceBySymbol[] = [];
  private subscription?: Subscription;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly calculator: PortfolioCalculatorService,
    private readonly minimumPerformanceService: MinimumPerformanceService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscription = this.state.state$.subscribe((snapshot) => {
      this.positions = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
      this.minimumPerformance = snapshot.dataset ? this.minimumPerformanceService.buildMinimumPerformanceBySymbol(snapshot) : [];
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  openDetail(symbol: string): void {
    this.router.navigate(['/posiciones', symbol]);
  }
}
