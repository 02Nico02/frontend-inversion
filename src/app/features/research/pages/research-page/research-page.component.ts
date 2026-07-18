import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { PortfolioPosition } from '../../../../core/models/portfolio.models';
import { ResearchAssetField, ResearchAssetItem, ResearchAssetKind } from '../../models/research.models';
import { ResearchExportService } from '../../services/research-export.service';
import { ResearchTemplateService } from '../../services/research-template.service';

const STORAGE_KEY = 'frontend-inversion.research-assets';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './research-page.component.html',
  styleUrls: ['./research-page.component.scss']
})
export class ResearchPageComponent implements OnInit, OnDestroy {
  searchTerm = '';
  selectedAssets: ResearchAssetItem[] = [];
  copyStatus = '';
  exportStatus = '';
  private subscription?: Subscription;
  private positionsCache: PortfolioPosition[] = [];

  constructor(
    public readonly state: PortfolioStateService,
    private readonly calculator: PortfolioCalculatorService,
    public readonly templateService: ResearchTemplateService,
    private readonly exportService: ResearchExportService,
    private readonly downloader: FileDownloadService
  ) {
    this.selectedAssets = this.loadFromStorage();
    this.positionsCache = this.state.snapshot.dataset
      ? this.calculator.enrichPositions(this.state.snapshot.dataset.positions, this.state.snapshot.dataset.classifications)
      : [];
  }

  ngOnInit(): void {
    this.subscription = this.state.state$.subscribe((snapshot) => {
      this.positionsCache = snapshot.dataset ? this.calculator.enrichPositions(snapshot.dataset.positions, snapshot.dataset.classifications) : [];
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get filteredPositions(): PortfolioPosition[] {
    const term = this.normalizeSearch(this.searchTerm);
    if (!term) {
      return this.positionsCache;
    }

    return this.positionsCache.filter((position) => {
      const values = [
        position.symbol,
        position.positionType,
        position.assetType,
        position.sector,
        position.subsector,
        position.region
      ].map((value) => this.normalizeSearch(String(value ?? '')));
      return values.some((value) => value.includes(term));
    });
  }

  get markdownPreview(): string {
    return this.exportService.buildMarkdown(this.selectedAssets);
  }

  get hasPositions(): boolean {
    return this.positionsCache.length > 0;
  }

  isSelected(position: PortfolioPosition): boolean {
    const querySymbol = this.normalizeSymbol(position.symbol);
    return this.selectedAssets.some((item) => this.normalizeSymbol(item.querySymbol) === querySymbol);
  }

  addPosition(position: PortfolioPosition): void {
    const querySymbol = this.normalizeSymbol(position.symbol);
    if (this.selectedAssets.some((item) => this.normalizeSymbol(item.querySymbol) === querySymbol)) {
      return;
    }

    this.selectedAssets = [...this.selectedAssets, this.templateService.createItem(position)];
    this.persist();
    this.exportStatus = '';
  }

  removeItem(id: string): void {
    this.selectedAssets = this.selectedAssets.filter((item) => item.id !== id);
    this.persist();
  }

  clearItems(): void {
    this.selectedAssets = [];
    this.persist();
  }

  updateKind(itemId: string, kind: ResearchAssetKind): void {
    this.selectedAssets = this.selectedAssets.map((item) => {
      if (item.id !== itemId) {
        return item;
      }
      return this.templateService.changeKind(item, kind);
    });
    this.persist();
  }

  updateQuerySymbol(itemId: string, value: string): void {
    const normalized = this.normalizeSymbol(value);
    const duplicate = this.selectedAssets.some((item) => item.id !== itemId && this.normalizeSymbol(item.querySymbol) === normalized);
    if (duplicate) {
      this.copyStatus = 'Ya existe una especie con ese símbolo de búsqueda.';
      return;
    }

    this.selectedAssets = this.selectedAssets.map((item) =>
      item.id === itemId
        ? { ...item, querySymbol: normalized, updatedAt: new Date().toISOString() }
        : item
    );
    this.persist();
    this.copyStatus = '';
  }

  updateField(itemId: string, label: string, value: string): void {
    this.selectedAssets = this.selectedAssets.map((item) => {
      if (item.id !== itemId) {
        return item;
      }
      return {
        ...item,
        fields: item.fields.map((field) => field.label === label ? { ...field, value } : field),
        updatedAt: new Date().toISOString()
      };
    });
    this.persist();
  }

  updateNotes(itemId: string, value: string): void {
    this.selectedAssets = this.selectedAssets.map((item) =>
      item.id === itemId ? { ...item, notes: value, updatedAt: new Date().toISOString() } : item
    );
    this.persist();
  }

  async copyMarkdown(): Promise<void> {
    const ok = await this.downloader.copyText(this.markdownPreview);
    this.copyStatus = ok ? 'Markdown copiado al portapapeles.' : 'No se pudo copiar el markdown.';
  }

  exportMarkdown(): void {
    const filename = this.exportService.buildFilename();
    this.downloader.downloadText(filename, this.markdownPreview, 'text/markdown;charset=utf-8');
    this.exportStatus = `Archivo generado: ${filename}`;
  }

  trackByPosition(_: number, item: PortfolioPosition): string {
    return item.symbol;
  }

  trackByItem(_: number, item: ResearchAssetItem): string {
    return item.id;
  }

  trackByField(_: number, item: ResearchAssetField): string {
    return item.label;
  }

  templateLabel(kind: ResearchAssetKind): string {
    return this.templateService.templateLabel(kind);
  }

  templateFields(kind: ResearchAssetKind): string[] {
    return this.templateService.templateFields(kind);
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.selectedAssets));
    } catch {
      // ignore storage issues
    }
  }

  private loadFromStorage(): ResearchAssetItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as Partial<ResearchAssetItem>[];
      return parsed.map((item) => this.templateService.hydrateItem(item));
    } catch {
      return [];
    }
  }

  private normalizeSearch(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private normalizeSymbol(value: string): string {
    return this.normalizeSearch(value);
  }
}
