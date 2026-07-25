import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PortfolioPosition } from '../../../../core/models/portfolio.models';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { ResearchAssetField, ResearchAssetItem, ResearchAssetKind } from '../../models/research.models';
import { AutofillUiState, ResearchAutofillResult, ResearchProviderSettings } from '../../models/research-provider.models';
import { MarketDataAutofillService } from '../../services/market-data-autofill.service';
import { ResearchCompletionService } from '../../services/research-completion.service';
import { ResearchExportService } from '../../services/research-export.service';
import { ResearchProviderSettingsService } from '../../services/research-provider-settings.service';
import { ResearchTextImportInput, ResearchTextImportResult, ResearchTextImportService } from '../../services/research-text-import.service';
import { ResearchTemplateService } from '../../services/research-template.service';

const STORAGE_KEY = 'frontend-inversion.research-assets';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './research-page.component.html',
  styleUrls: ['./research-page.component.scss']
})
export class ResearchPageComponent implements OnInit, OnDestroy {
  activeStep: 'select' | 'complete' | 'export' = 'select';
  searchTerm = '';
  selectedAssets: ResearchAssetItem[] = [];
  copyStatus = '';
  exportStatus = '';
  showPreview = true;
  settingsOpen = false;
  showProviderSettingsPanel = false;
  showTextImportPanel = false;
  textImportSuggestionsOpen = false;
  editingItemId: string | null = null;
  providerSettings: ResearchProviderSettings;
  expandedIds = new Set<string>();
  overwriteById: Record<string, boolean> = {};
  autofillStates: Record<string, AutofillUiState> = {};
  textImportSymbol = '';
  textImportKind: ResearchAssetKind = 'stock';
  textImportRawText = '';
  textImportPreview: ResearchTextImportResult | null = null;
  textImportStatus = '';
  private subscription?: Subscription;
  private positionsCache: PortfolioPosition[] = [];

  constructor(
    public readonly state: PortfolioStateService,
    private readonly hostRef: ElementRef<HTMLElement>,
    private readonly calculator: PortfolioCalculatorService,
    public readonly templateService: ResearchTemplateService,
    public readonly completionService: ResearchCompletionService,
    private readonly exportService: ResearchExportService,
    private readonly providerSettingsService: ResearchProviderSettingsService,
    private readonly autofillService: MarketDataAutofillService,
    private readonly textImportService: ResearchTextImportService,
    private readonly downloader: FileDownloadService
  ) {
    this.selectedAssets = this.loadFromStorage();
    this.providerSettings = this.providerSettingsService.load();
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

  get markdownSummary(): string {
    const summary = this.completionService.summarizeMany(this.selectedAssets);
    return `${this.selectedAssets.length} especies seleccionadas · ${summary.completedFields}/${summary.totalFields} campos completos`;
  }

  get hasPositions(): boolean {
    return this.positionsCache.length > 0;
  }

  get editingItem(): ResearchAssetItem | null {
    return this.selectedAssets.find((item) => item.id === this.editingItemId) ?? null;
  }

  isSelected(position: PortfolioPosition): boolean {
    const symbol = this.normalizeSymbol(position.symbol);
    return this.selectedAssets.some((item) =>
      this.normalizeSymbol(item.portfolioSymbol) === symbol || this.normalizeSymbol(item.querySymbol) === symbol
    );
  }

  providerLabel(item: ResearchAssetItem): string {
    return this.autofillService.providerLabel(item);
  }

  canAutofill(item: ResearchAssetItem): boolean {
    return this.autofillService.canAutofill(item);
  }

  autofillState(itemId: string): AutofillUiState {
    return this.autofillStates[itemId] ?? { status: 'idle', message: '' };
  }

  overwriteValue(itemId: string): boolean {
    return this.overwriteById[itemId] ?? false;
  }

  setActiveStep(step: 'select' | 'complete' | 'export'): void {
    this.activeStep = step;
    if (step !== 'complete') {
      this.editingItemId = null;
    }
  }

  toggleProviderSettingsPanel(): void {
    this.showProviderSettingsPanel = !this.showProviderSettingsPanel;
  }

  toggleTextImportPanel(): void {
    this.showTextImportPanel = !this.showTextImportPanel;
  }

  startEditing(itemId: string): void {
    this.editingItemId = itemId;
    this.activeStep = 'complete';
  }

  stopEditing(): void {
    this.editingItemId = null;
  }

  async autofillItem(item: ResearchAssetItem): Promise<void> {
    if (!this.canAutofill(item)) {
      this.setAutofillState(item.id, 'error', this.unsupportedMessage(item));
      return;
    }

    if ((item.kind === 'stock' || item.kind === 'etf') && !this.providerSettings.alphaVantageApiKey.trim()) {
      this.setAutofillState(item.id, 'error', 'Falta la API key de Alpha Vantage.');
      return;
    }

    this.setAutofillState(item.id, 'loading', `Consultando ${this.providerLabel(item)}...`);

    const result = await this.autofillService.autofill(item, this.overwriteValue(item.id), this.providerSettings);
    if (result.errors.length) {
      this.setAutofillState(item.id, 'error', result.errors[0]);
      return;
    }

    this.selectedAssets = this.selectedAssets.map((current) =>
      current.id === item.id ? this.applyAutofillResult(current, result, this.overwriteValue(item.id)) : current
    );
    this.persist();

    const providerLabel = result.provider === 'alpha_vantage' ? 'Alpha Vantage' : 'CoinGecko';
    const message = result.warnings.length
      ? `Datos actualizados desde ${providerLabel}. Algunos campos no estuvieron disponibles.`
      : `Datos actualizados desde ${providerLabel}.`;
    this.setAutofillState(item.id, 'success', message);
  }

  addPosition(position: PortfolioPosition): void {
    const symbol = this.normalizeSymbol(position.symbol);
    if (this.selectedAssets.some((item) =>
      this.normalizeSymbol(item.portfolioSymbol) === symbol || this.normalizeSymbol(item.querySymbol) === symbol
    )) {
      return;
    }

    const item = this.templateService.createItem(position);
    this.selectedAssets = [...this.selectedAssets, item];
    this.expandedIds.add(item.id);
    this.editingItemId = item.id;
    this.activeStep = 'complete';
    this.persist();
    this.exportStatus = '';

    if (this.canAutofill(item)) {
      queueMicrotask(() => {
        void this.autofillItem(item);
      });
    }
  }

  removeItem(id: string): void {
    this.selectedAssets = this.selectedAssets.filter((item) => item.id !== id);
    this.expandedIds.delete(id);
    delete this.autofillStates[id];
    delete this.overwriteById[id];
    if (this.editingItemId === id) {
      this.editingItemId = this.selectedAssets[0]?.id ?? null;
    }
    this.persist();
  }

  clearItems(): void {
    this.selectedAssets = [];
    this.expandedIds.clear();
    this.autofillStates = {};
    this.overwriteById = {};
    this.editingItemId = null;
    this.activeStep = 'select';
    this.persist();
  }

  updateKind(itemId: string, kind: ResearchAssetKind): void {
    this.selectedAssets = this.selectedAssets.map((item) => {
      if (item.id !== itemId) {
        return item;
      }
      return this.markManualChange(this.templateService.changeKind(item, kind));
    });
    this.persist();
  }

  completion(item: ResearchAssetItem) {
    return this.completionService.summarize(item);
  }

  completionLabel(item: ResearchAssetItem): string {
    return this.completionService.statusLabel(this.completion(item).status);
  }

  itemSummary(item: ResearchAssetItem): string {
    const summary = this.completion(item);
    return `Campos completos: ${summary.completedFields}/${summary.totalFields}`;
  }

  missingFields(item: ResearchAssetItem): string {
    const missing = this.completion(item).missingFields;
    return missing.length ? missing.join(', ') : 'Ninguno';
  }

  missingFieldsPreview(item: ResearchAssetItem): string {
    const missing = this.completion(item).missingFields;
    if (!missing.length) {
      return 'Ninguno';
    }
    if (missing.length <= 3) {
      return missing.join(', ');
    }
    return `${missing.slice(0, 3).join(', ')} +${missing.length - 3} más`;
  }

  toggleExpanded(id: string): void {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
      return;
    }
    this.expandedIds.add(id);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds.has(id);
  }

  updateQuerySymbol(itemId: string, value: string): void {
    const normalized = this.normalizeSymbol(value);
    const duplicate = this.selectedAssets.some((item) => item.id !== itemId && this.normalizeSymbol(item.querySymbol) === normalized);
    if (duplicate) {
      this.copyStatus = 'Ya existe una especie con ese símbolo de búsqueda.';
      return;
    }

    this.selectedAssets = this.selectedAssets.map((item) =>
      item.id === itemId ? this.markManualChange({ ...item, querySymbol: normalized }) : item
    );
    this.persist();
    this.copyStatus = '';
  }

  updateField(itemId: string, label: string, value: string): void {
    this.selectedAssets = this.selectedAssets.map((item) => {
      if (item.id !== itemId) {
        return item;
      }
      return this.markManualChange({
        ...item,
        fields: item.fields.map((field) => (field.label === label ? { ...field, value } : field))
      });
    });
    this.persist();
  }

  updateNotes(itemId: string, value: string): void {
    this.selectedAssets = this.selectedAssets.map((item) =>
      item.id === itemId ? this.markManualChange({ ...item, notes: value }) : item
    );
    this.persist();
  }

  previewTextImport(): void {
    const validation = this.validateTextImport();
    if (validation) {
      this.textImportPreview = null;
      this.textImportStatus = validation;
      return;
    }

    this.textImportPreview = this.textImportService.preview(this.buildTextImportInput());
    this.textImportStatus = this.textImportPreview.matchedKeys.length
      ? `Se detectaron ${this.textImportPreview.matchedKeys.length} campos para completar.`
      : 'No se encontraron campos reconocibles.';
  }

  addFromText(): void {
    const validation = this.validateTextImport();
    if (validation) {
      this.textImportPreview = null;
      this.textImportStatus = validation;
      return;
    }

    const input = this.buildTextImportInput();
    const result = this.textImportService.preview(input);
    const existing = this.findExistingResearchItem(input.portfolioSymbol, input.querySymbol);

    if (existing) {
      this.selectedAssets = this.selectedAssets.map((item) =>
        item.id === existing.id ? this.applyTextImportToExistingItem(item, result) : item
      );
      this.expandedIds.add(existing.id);
      this.editingItemId = existing.id;
      this.activeStep = 'complete';
      this.textImportPreview = result;
      this.textImportStatus = 'Especie existente actualizada desde texto.';
      this.persist();
      this.copyStatus = '';
      this.exportStatus = '';
      return;
    }

    const item = this.textImportService.createItem(input);
    this.selectedAssets = [...this.selectedAssets, item];
    this.expandedIds.add(item.id);
    this.editingItemId = item.id;
    this.activeStep = 'complete';
    this.persist();
    this.textImportPreview = result;
    this.textImportStatus = 'Especie agregada desde texto.';
    this.copyStatus = '';
    this.exportStatus = '';
  }

  clearTextImport(): void {
    this.textImportSymbol = '';
    this.textImportKind = 'stock';
    this.textImportRawText = '';
    this.textImportPreview = null;
    this.textImportStatus = '';
    this.textImportSuggestionsOpen = false;
  }

  saveProviderSettings(silent = false): void {
    this.providerSettingsService.save(this.providerSettings);
    if (!silent) {
      this.copyStatus = 'Configuración de proveedores guardada.';
    }
  }

  clearProviderSettings(): void {
    this.providerSettings = this.providerSettingsService.clear();
    this.copyStatus = 'API keys borradas del navegador.';
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

  get textImportSuggestions(): PortfolioPosition[] {
    const term = this.normalizeSearch(this.textImportSymbol);
    if (!term) {
      return [];
    }

    return this.positionsCache
      .filter((position) => {
        const values = [
          position.symbol,
          position.positionType,
          position.assetType,
          position.sector,
          position.subsector,
          position.region
        ].map((value) => this.normalizeSearch(String(value ?? '')));
        return values.some((value) => value.includes(term));
      })
      .sort((left, right) => {
        const normalizedTerm = this.normalizeSymbol(this.textImportSymbol);
        const leftSymbol = this.normalizeSymbol(left.symbol);
        const rightSymbol = this.normalizeSymbol(right.symbol);
        const leftExact = leftSymbol === normalizedTerm ? 0 : leftSymbol.startsWith(normalizedTerm) ? 1 : 2;
        const rightExact = rightSymbol === normalizedTerm ? 0 : rightSymbol.startsWith(normalizedTerm) ? 1 : 2;
        if (leftExact !== rightExact) {
          return leftExact - rightExact;
        }
        return leftSymbol.localeCompare(rightSymbol);
      })
      .slice(0, 6);
  }

  get textImportDetectedKindLabel(): string {
    const position = this.matchTextImportPosition(this.textImportSymbol);
    return position ? this.templateLabel(this.templateService.detectKind(position)) : '';
  }

  get textImportSuggestionsVisible(): boolean {
    return this.textImportSuggestionsOpen && this.textImportSuggestions.length > 0;
  }

  get textImportActionLabel(): string {
    const symbol = this.normalizeSymbol(this.textImportSymbol);
    return this.findExistingResearchItem(symbol, symbol) ? 'Actualizar existente' : 'Agregar desde texto';
  }

  onTextImportSymbolChange(value: string): void {
    this.textImportSymbol = value;
    this.textImportPreview = null;
    this.textImportStatus = '';
    this.textImportSuggestionsOpen = true;

    const position = this.matchTextImportPosition(value);
    if (position) {
      this.textImportKind = this.templateService.detectKind(position);
    }
  }

  openTextImportSuggestions(): void {
    if (this.normalizeSymbol(this.textImportSymbol)) {
      this.textImportSuggestionsOpen = true;
    }
  }

  closeTextImportSuggestions(): void {
    this.textImportSuggestionsOpen = false;
  }

  selectTextImportSuggestion(position: PortfolioPosition): void {
    this.textImportSymbol = this.normalizeSymbol(position.symbol);
    this.textImportKind = this.templateService.detectKind(position);
    this.textImportPreview = null;
    this.textImportStatus = '';
    this.textImportSuggestionsOpen = false;
  }

  private setAutofillState(itemId: string, status: AutofillUiState['status'], message: string): void {
    this.autofillStates = {
      ...this.autofillStates,
      [itemId]: { status, message }
    };
  }

  private buildTextImportInput(): ResearchTextImportInput {
    const portfolioSymbol = this.normalizeSymbol(this.textImportSymbol);
    return {
      portfolioSymbol,
      querySymbol: portfolioSymbol,
      kind: this.textImportKind,
      rawText: this.textImportRawText
    };
  }

  private validateTextImport(): string {
    if (!this.normalizeSymbol(this.textImportSymbol)) {
      return 'Ingresá un símbolo.';
    }
    if (!String(this.textImportRawText ?? '').trim()) {
      return 'Pegá un texto para extraer.';
    }
    return '';
  }

  private findExistingResearchItem(portfolioSymbol: string, querySymbol: string): ResearchAssetItem | null {
    const normalizedPortfolioSymbol = this.normalizeSymbol(portfolioSymbol);
    const normalizedQuerySymbol = this.normalizeSymbol(querySymbol);

    return this.selectedAssets.find((item) =>
      this.normalizeSymbol(item.portfolioSymbol) === normalizedPortfolioSymbol
      || this.normalizeSymbol(item.querySymbol) === normalizedPortfolioSymbol
      || this.normalizeSymbol(item.portfolioSymbol) === normalizedQuerySymbol
      || this.normalizeSymbol(item.querySymbol) === normalizedQuerySymbol
    ) ?? null;
  }

  private matchTextImportPosition(value: string): PortfolioPosition | null {
    const normalized = this.normalizeSymbol(value);
    if (!normalized) {
      return null;
    }

    return this.positionsCache.find((position) => this.normalizeSymbol(position.symbol) === normalized) ?? null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.closeTextImportSuggestions();
    }
  }

  private applyTextImportToExistingItem(item: ResearchAssetItem, result: ResearchTextImportResult): ResearchAssetItem {
    return {
      ...item,
      source: item.source === 'manual' ? 'manual' : 'mixed',
      fields: item.fields.map((field) => {
        const incoming = result.fields[field.label];
        if (incoming === undefined || incoming === null || String(incoming).trim() === '') {
          return field;
        }

        return {
          ...field,
          value: incoming
        };
      }),
      updatedAt: new Date().toISOString()
    };
  }

  private applyAutofillResult(item: ResearchAssetItem, result: ResearchAutofillResult, overwrite: boolean): ResearchAssetItem {
    const nextFields = item.fields.map((field) => {
      const incoming = result.fields[field.label];
      if (incoming === undefined || incoming === null || String(incoming).trim() === '') {
        return field;
      }
      if (!overwrite && String(field.value ?? '').trim().length > 0) {
        return field;
      }
      return { ...field, value: incoming };
    });

    return {
      ...item,
      fields: nextFields,
      source: result.provider,
      updatedAt: result.fetchedAt
    };
  }

  private markManualChange(item: ResearchAssetItem): ResearchAssetItem {
    return {
      ...item,
      source: item.source === 'manual' ? 'manual' : 'mixed',
      updatedAt: new Date().toISOString()
    };
  }

  private unsupportedMessage(item: ResearchAssetItem): string {
    return item.kind === 'arg_bond'
      ? 'Autocompletado no disponible para bonos argentinos en este MVP.'
      : 'Autocompletado no disponible para plantilla manual.';
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


