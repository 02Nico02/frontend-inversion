import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkbookValidationReport } from '../../../core/models/workbook.models';

@Component({
  selector: 'app-validation-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './validation-summary.component.html',
  styleUrls: ['./validation-summary.component.scss'],
})
export class ValidationSummaryComponent {
  @Input() report: WorkbookValidationReport | null = null;
}
