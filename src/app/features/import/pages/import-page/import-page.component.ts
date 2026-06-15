import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ImportPanelComponent } from '../../../../shared/components/import-panel/import-panel.component';
import { ValidationSummaryComponent } from '../../../../shared/components/validation-summary/validation-summary.component';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioImportService } from '../../../../core/services/portfolio-import.service';

@Component({
  standalone: true,
  imports: [CommonModule, ImportPanelComponent, ValidationSummaryComponent],
  templateUrl: './import-page.component.html',
  styleUrls: ['./import-page.component.scss'],
})
export class ImportPageComponent {
  constructor(
    public readonly state: PortfolioStateService,
    private readonly router: Router,
    private readonly importService: PortfolioImportService
  ) {}

  async handleFile(file: File): Promise<void> {
    const imported = await this.importService.importFile(file);
    if (imported) {
      this.router.navigateByUrl('/resumen');
    }
  }
}
