import { Injectable } from '@angular/core';
import { PortfolioPosition } from '../../../core/models/portfolio.models';
import { ResearchAssetField, ResearchAssetItem, ResearchAssetKind, ResearchTemplateDefinition } from '../models/research.models';

const TEMPLATE_DEFINITIONS: ResearchTemplateDefinition[] = [
  {
    kind: 'stock',
    label: 'Acción / CEDEAR',
    description: 'Plantilla para acciones y CEDEARs.',
    fields: [
      'Precio',
      'Target Price',
      'P/E',
      'Forward P/E',
      'PEG',
      'ROE',
      'ROIC',
      'Debt/Eq',
      'Operating Margin',
      'Profit Margin',
      'EPS Y/Y',
      'Sales Y/Y',
      'EPS next Y',
      'EPS next 5Y',
      'RSI',
      'SMA20',
      'SMA50',
      'SMA200',
      '52W High',
      '52W Low',
      'Perf Month',
      'Perf Quarter',
      'Perf YTD',
      'Perf Year'
    ]
  },
  {
    kind: 'etf',
    label: 'ETF',
    description: 'Plantilla para ETFs.',
    fields: [
      'Precio',
      'RSI',
      'SMA20',
      'SMA50',
      'SMA200',
      '52W High',
      '52W Low',
      'Perf Month',
      'Perf Quarter',
      'Perf YTD',
      'Perf Year'
    ]
  },
  {
    kind: 'arg_bond',
    label: 'Bono soberano argentino',
    description: 'Plantilla para bonos soberanos argentinos.',
    fields: [
      'Precio',
      'TIR',
      'Paridad',
      'Duration',
      'Vencimiento',
      'Ley',
      'Moneda',
      'Cupón',
      'Perf Month',
      'Perf YTD',
      'Perf Year'
    ]
  },
  {
    kind: 'crypto',
    label: 'Cripto',
    description: 'Plantilla para criptomonedas.',
    fields: [
      'Precio',
      'RSI',
      'SMA20',
      'SMA50',
      'SMA200',
      '52W High',
      '52W Low',
      'Perf Month',
      'Perf Quarter',
      'Perf YTD',
      'Perf Year'
    ]
  },
  {
    kind: 'manual',
    label: 'Manual / desconocido',
    description: 'Plantilla básica manual.',
    fields: ['Precio', 'Notas']
  }
];

@Injectable({ providedIn: 'root' })
export class ResearchTemplateService {
  readonly templates = TEMPLATE_DEFINITIONS;

  detectKind(position: PortfolioPosition): ResearchAssetKind {
    const type = this.normalize([position.assetType, position.positionType].join(' '));
    const sector = this.normalize(String(position.sector ?? ''));
    const subsector = this.normalize(String(position.subsector ?? ''));
    const region = this.normalize(String(position.region ?? ''));

    if (type.includes('ETF')) {
      return 'etf';
    }
    if (type.includes('CEDEAR') || type.includes('ACCION') || type.includes('ACCION')) {
      return 'stock';
    }
    if (type.includes('CRIPTO') || sector.includes('CRIPTOMONEDAS') || subsector.includes('CRIPTO') || region.includes('CRIPTO')) {
      return 'crypto';
    }
    if (type.includes('BONO') || sector.includes('SOBERAN') || subsector.includes('SOBERAN')) {
      return 'arg_bond';
    }
    return 'manual';
  }

  templateLabel(kind: ResearchAssetKind): string {
    return this.templateFor(kind).label;
  }

  templateFields(kind: ResearchAssetKind): string[] {
    return [...this.templateFor(kind).fields];
  }

  templateDefinition(kind: ResearchAssetKind): ResearchTemplateDefinition {
    return this.templateFor(kind);
  }

  createItem(position: PortfolioPosition): ResearchAssetItem {
    const kind = this.detectKind(position);
    return {
      id: this.createId(),
      portfolioSymbol: this.normalizeSymbol(position.symbol),
      querySymbol: this.normalizeSymbol(position.symbol),
      kind,
      assetType: position.assetType ?? position.positionType ?? undefined,
      sector: position.sector ?? undefined,
      region: position.region ?? undefined,
      source: 'manual',
      fields: this.buildEmptyFields(kind),
      notes: '',
      updatedAt: this.nowIso()
    };
  }

  createEmptyItem(portfolioSymbol: string, kind: ResearchAssetKind = 'manual'): ResearchAssetItem {
    return {
      id: this.createId(),
      portfolioSymbol: this.normalizeSymbol(portfolioSymbol),
      querySymbol: this.normalizeSymbol(portfolioSymbol),
      kind,
      source: 'manual',
      fields: this.buildEmptyFields(kind),
      notes: '',
      updatedAt: this.nowIso()
    };
  }

  hydrateItem(raw: Partial<ResearchAssetItem>): ResearchAssetItem {
    const kind = this.isKind(raw.kind) ? raw.kind : 'manual';
    const portfolioSymbol = this.normalizeSymbol(raw.portfolioSymbol ?? raw.querySymbol ?? '');
    const querySymbol = this.normalizeSymbol(raw.querySymbol ?? raw.portfolioSymbol ?? '');
    const templateFields = this.templateFields(kind);
    const existingFields = new Map((raw.fields ?? []).map((field) => [this.normalizeLabel(field.label), field.value] as const));

    return {
      id: String(raw.id ?? this.createId()),
      portfolioSymbol,
      querySymbol,
      kind,
      assetType: raw.assetType ?? undefined,
      sector: raw.sector ?? undefined,
      region: raw.region ?? undefined,
      source: 'manual',
      fields: templateFields.map((label) => ({
        label,
        value: existingFields.get(this.normalizeLabel(label)) ?? ''
      })),
      notes: raw.notes ?? '',
      updatedAt: raw.updatedAt ?? this.nowIso()
    };
  }

  changeKind(item: ResearchAssetItem, kind: ResearchAssetKind): ResearchAssetItem {
    const existingFields = new Map(item.fields.map((field) => [this.normalizeLabel(field.label), field.value] as const));
    return {
      ...item,
      kind,
      fields: this.templateFields(kind).map((label) => ({
        label,
        value: existingFields.get(this.normalizeLabel(label)) ?? ''
      })),
      updatedAt: this.nowIso()
    };
  }

  isKind(value: unknown): value is ResearchAssetKind {
    return value === 'stock' || value === 'etf' || value === 'arg_bond' || value === 'crypto' || value === 'manual';
  }

  private templateFor(kind: ResearchAssetKind): ResearchTemplateDefinition {
    return TEMPLATE_DEFINITIONS.find((template) => template.kind === kind) ?? TEMPLATE_DEFINITIONS[TEMPLATE_DEFINITIONS.length - 1];
  }

  private buildEmptyFields(kind: ResearchAssetKind): ResearchAssetField[] {
    return this.templateFields(kind).map((label) => ({ label, value: '' }));
  }

  private normalizeSymbol(value: string): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private normalize(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private normalizeLabel(value: string): string {
    return this.normalize(value);
  }

  private createId(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `research-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private nowIso(): string {
    return new Date().toISOString();
  }
}

