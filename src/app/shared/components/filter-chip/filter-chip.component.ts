import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-filter-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-chip.component.html',
  styleUrls: ['./filter-chip.component.scss']
})
export class FilterChipComponent {
  @Input() label = '';
  @Input() value = '';
  @Output() remove = new EventEmitter<void>();
}
