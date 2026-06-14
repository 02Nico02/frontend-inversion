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
  template: `
    <div class="combo">
      <label class="combo-label">
        <span>Especie</span>
        <div class="combo-shell" [class.open]="open">
          <input
            #inputEl
            type="text"
            role="combobox"
            aria-autocomplete="list"
            [attr.aria-expanded]="open"
            [attr.aria-controls]="listId"
            [attr.aria-activedescendant]="activeOptionId"
            [(ngModel)]="searchTerm"
            (focus)="openDropdown()"
            (input)="onInputChange()"
            (keydown)="onKeyDown($event)"
            placeholder="Elegí una especie"
          />
          <button type="button" class="chevron" (click)="toggleOpen()" aria-label="Abrir lista">⌄</button>
        </div>
      </label>

      <div class="dropdown" *ngIf="open" [id]="listId" role="listbox">
        <button
          type="button"
          class="option"
          *ngFor="let option of filteredOptions; let index = index; trackBy: trackBySymbol"
          [id]="optionId(option.symbol)"
          role="option"
          [attr.aria-selected]="option.symbol === selectedSymbol"
          [class.active]="index === activeIndex"
          (mouseenter)="activeIndex = index"
          (click)="select(option)"
        >
          <strong>{{ option.symbol }}</strong>
          <span>{{ option.label }}</span>
        </button>

        <div class="empty" *ngIf="!filteredOptions.length">
          No se encontraron especies
        </div>
      </div>
    </div>
  `,
  styles: [`
    .combo {
      display: grid;
      gap: 0.35rem;
      position: relative;
      color: var(--muted);
      font-size: 0.85rem;
    }
    .combo-label {
      display: grid;
      gap: 0.35rem;
    }
    .combo-shell {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 0.1rem 0.15rem 0.1rem 0.75rem;
    }
    .combo-shell.open {
      border-color: var(--brand);
      box-shadow: 0 0 0 1px rgba(72, 227, 218, 0.2);
    }
    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--text);
      padding: 0.6rem 0;
      font: inherit;
    }
    .chevron {
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      border-radius: 8px;
    }
    .dropdown {
      position: absolute;
      top: calc(100% + 0.35rem);
      left: 0;
      right: 0;
      z-index: 20;
      max-height: 320px;
      overflow: auto;
      background: #101832;
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      padding: 0.35rem;
    }
    .option {
      width: 100%;
      display: grid;
      gap: 0.15rem;
      text-align: left;
      background: transparent;
      border: 0;
      color: var(--text);
      border-radius: 10px;
      padding: 0.65rem 0.7rem;
      cursor: pointer;
    }
    .option strong {
      font-size: 0.9rem;
    }
    .option span {
      color: var(--muted);
      font-size: 0.8rem;
      white-space: normal;
    }
    .option.active,
    .option:hover {
      background: rgba(255, 255, 255, 0.07);
    }
    .empty {
      padding: 0.8rem 0.7rem;
      color: var(--muted);
      font-size: 0.85rem;
    }
  `]
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
