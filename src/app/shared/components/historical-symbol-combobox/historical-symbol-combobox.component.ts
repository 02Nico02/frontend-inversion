import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface HistoricalSymbolOption {
  symbol: string;
  label: string;
  searchText: string;
}

@Component({
  selector: 'app-historical-symbol-combobox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historical-symbol-combobox.component.html',
  styleUrls: ['./historical-symbol-combobox.component.scss'],
})
export class HistoricalSymbolComboboxComponent {
  @Input() options: HistoricalSymbolOption[] = [];
  @Input() selectedSymbol = '';
  @Output() selectedSymbolChange = new EventEmitter<string>();

  open = false;
  searchTerm = '';
  activeIndex = 0;
  readonly listId = 'historical-symbol-list';

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  get filteredOptions(): HistoricalSymbolOption[] {
    const term = this.searchTerm.trim().toLowerCase();
    const ordered = [...this.options].sort((a, b) => a.label.localeCompare(b.label, 'es'));
    if (!term) {
      return ordered;
    }
    return ordered.filter((option) => {
      const haystack = `${option.symbol} ${option.label} ${option.searchText}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  get activeOptionId(): string | null {
    const option = this.filteredOptions[this.activeIndex];
    return option ? this.optionId(option.symbol) : null;
  }

  ngOnChanges(): void {
    this.syncActiveIndex();
  }

  openDropdown(): void {
    this.open = true;
    this.syncActiveIndex();
  }

  toggleOpen(): void {
    this.open = !this.open;
    if (this.open) {
      this.openDropdown();
    }
  }

  onInputChange(): void {
    this.open = true;
    this.syncActiveIndex();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (!this.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      this.open = true;
    }
    if (!this.filteredOptions.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.filteredOptions.length - 1, this.activeIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.filteredOptions[this.activeIndex] ?? this.filteredOptions[0];
      if (option) {
        this.select(option);
      }
    }
  }

  select(option: HistoricalSymbolOption): void {
    this.selectedSymbol = option.symbol;
    this.selectedSymbolChange.emit(option.symbol);
    this.searchTerm = option.label;
    this.open = false;
    this.activeIndex = 0;
  }

  close(): void {
    this.open = false;
    this.syncActiveIndex();
  }

  trackBySymbol(index: number, option: HistoricalSymbolOption): string {
    return option.symbol || `${index}`;
  }

  optionId(symbol: string): string {
    return `${this.listId}-${symbol}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  private syncActiveIndex(): void {
    const selected = this.filteredOptions.findIndex((option) => option.symbol === this.selectedSymbol);
    if (selected >= 0) {
      this.activeIndex = selected;
      return;
    }
    this.activeIndex = Math.min(this.activeIndex, Math.max(0, this.filteredOptions.length - 1));
  }
}
