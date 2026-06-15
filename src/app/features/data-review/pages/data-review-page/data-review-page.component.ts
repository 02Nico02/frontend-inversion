import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioHealthService } from '../../../../core/services/portfolio-health.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-review-page.component.html',
  styleUrls: ['./data-review-page.component.scss'],
})
export class DataReviewPageComponent {
  constructor(public readonly state: PortfolioStateService, private readonly healthService: PortfolioHealthService) {}

  report(snapshot: PortfolioAppState) {
    return this.healthService.buildReport(snapshot.dataset!, snapshot.workbook!.validation);
  }
}
