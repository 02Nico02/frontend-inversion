import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchText?: string;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss']
})
export class SearchableSelectComponent {
  @Input() label = '';
  @Input() placeholder = 'Buscar...';
  @Input() allLabel = 'Todas';
  @Input() emptyLabel = 'No se encontraron opciones';
  @Input() showAllOption = true;
  @Input() disabled = false;
  @Input() options: SearchableSelectOption[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  open = false;
  searchTerm = '';
  activeIndex = 0;
  readonly listId = `searchable-select-${Math.random().toString(36).slice(2)}`;

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  get selectedLabel(): string {
    if (this.value === '' && this.showAllOption) {
      return this.allLabel;
    }
    return this.options.find((option) => option.value === this.value)?.label ?? this.value ?? '';
  }

  get inputValue(): string {
    return this.open ? this.searchTerm : this.selectedLabel;
  }

  get filteredOptions(): SearchableSelectOption[] {
    const ordered = [...this.options].sort((a, b) => a.label.localeCompare(b.label, 'es'));
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return ordered;
    }
    return ordered.filter((option) => {
      const haystack = `${option.value} ${option.label} ${option.searchText ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  get activeOptionId(): string | null {
    const option = this.filteredOptions[this.activeIndex];
    return option ? this.optionId(option.value) : null;
  }

  openDropdown(): void {
    if (this.disabled) return;
    this.open = true;
    this.searchTerm = '';
    this.syncActiveIndex();
  }

  closeDropdown(): void {
    this.open = false;
    this.searchTerm = '';
    this.syncActiveIndex();
  }

  toggleDropdown(): void {
    if (this.open) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  onInputFocus(): void {
    this.openDropdown();
  }

  onInputChange(value: string): void {
    this.searchTerm = value;
    this.open = true;
    this.syncActiveIndex();
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown();
      return;
    }
    if (!this.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      this.openDropdown();
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

  select(option: SearchableSelectOption): void {
    this.value = option.value;
    this.valueChange.emit(option.value);
    this.searchTerm = '';
    this.open = false;
    this.activeIndex = 0;
  }

  clear(): void {
    this.select({ value: '', label: this.allLabel });
  }

  optionId(value: string): string {
    return `${this.listId}-${value || 'all'}`;
  }

  trackByValue(index: number, option: SearchableSelectOption): string {
    return option.value || `${index}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.closeDropdown();
    }
  }

  private syncActiveIndex(): void {
    const selected = this.filteredOptions.findIndex((option) => option.value === this.value);
    this.activeIndex = selected >= 0 ? selected : Math.min(this.activeIndex, Math.max(0, this.filteredOptions.length - 1));
  }
}
