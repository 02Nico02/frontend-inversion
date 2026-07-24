import { Injectable } from '@angular/core';
import { ResearchAssetItem, ResearchAssetKind } from '../models/research.models';
import { ResearchTemplateService } from './research-template.service';

export interface ResearchTextImportInput {
  portfolioSymbol: string;
  querySymbol: string;
  kind: ResearchAssetKind;
  rawText: string;
}

export interface ResearchTextImportResult {
  fields: Record<string, string>;
  matchedKeys: string[];
  missingFields: string[];
  warnings: string[];
  fieldSources: Record<string, string>;
}

type ParsedEntry = {
  sourceKey: string;
  normalizedKey: string;
  value: string;
};

@Injectable({ providedIn: 'root' })
export class ResearchTextImportService {
  constructor(private readonly templates: ResearchTemplateService) {}

  preview(input: ResearchTextImportInput): ResearchTextImportResult {
    const rawText = String(input.rawText ?? '').trim();
    if (!rawText) {
      return {
        fields: {},
        matchedKeys: [],
        missingFields: this.templates.templateFields(input.kind),
        warnings: ['El texto pegado está vacío.'],
        fieldSources: {}
      };
    }

    const fieldAliases = this.fieldAliasesFor(input.kind);
    const knownKeys = this.knownKeysFor(input.kind, fieldAliases);
    const entries = this.parseEntries(rawText, knownKeys);
    const groupedEntries = this.groupEntries(entries);
    const fields: Record<string, string> = {};
    const fieldSources: Record<string, string> = {};
    const matchedKeys: string[] = [];

    for (const [fieldLabel, aliases] of Object.entries(fieldAliases)) {
      const match = this.findMatch(groupedEntries, aliases, this.shouldPreferPercent(fieldLabel));
      if (!match) {
        continue;
      }
      fields[fieldLabel] = match.value;
      fieldSources[fieldLabel] = match.sourceKey;
      matchedKeys.push(fieldLabel);
    }

    const missingFields = this.templates.templateFields(input.kind).filter((label) => !String(fields[label] ?? '').trim());
    const warnings: string[] = [];
    if (!matchedKeys.length) {
      warnings.push('No se encontraron campos reconocibles en el texto pegado.');
    }
    if (entries.length % 2 !== 0) {
      warnings.push('El texto pegado tiene una última línea sin valor asociado.');
    }

    return {
      fields,
      matchedKeys,
      missingFields,
      warnings,
      fieldSources
    };
  }

  createItem(input: ResearchTextImportInput): ResearchAssetItem {
    const portfolioSymbol = this.normalizeSymbol(input.portfolioSymbol);
    const querySymbol = this.normalizeSymbol(input.querySymbol || input.portfolioSymbol);
    const preview = this.preview({ ...input, portfolioSymbol, querySymbol, rawText: input.rawText });
    const item = this.templates.createEmptyItem(portfolioSymbol, input.kind);

    return {
      ...item,
      portfolioSymbol,
      querySymbol,
      fields: item.fields.map((field) => ({
        ...field,
        value: preview.fields[field.label] ?? ''
      })),
      notes: '',
      source: 'manual',
      updatedAt: new Date().toISOString()
    };
  }

  private parseEntries(rawText: string, knownKeys: Set<string>): ParsedEntry[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const entries: ParsedEntry[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const sourceKey = lines[index];
      const normalizedKey = this.normalizeKey(sourceKey);
      if (!knownKeys.has(normalizedKey)) {
        continue;
      }

      let value = '';
      for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
        const candidate = lines[nextIndex];
        if (!candidate) {
          continue;
        }

        const candidateKey = this.normalizeKey(candidate);
        if (knownKeys.has(candidateKey)) {
          break;
        }

        value = candidate.trim();
        break;
      }

      if (!value) {
        continue;
      }

      entries.push({
        sourceKey,
        normalizedKey,
        value
      });
    }

    return entries;
  }

  private groupEntries(entries: ParsedEntry[]): Map<string, ParsedEntry[]> {
    const grouped = new Map<string, ParsedEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.normalizedKey) ?? [];
      list.push(entry);
      grouped.set(entry.normalizedKey, list);
    }
    return grouped;
  }

  private findMatch(
    groupedEntries: Map<string, ParsedEntry[]>,
    aliases: string[],
    preferPercent: boolean
  ): ParsedEntry | null {
    for (const alias of aliases) {
      const matches = groupedEntries.get(this.normalizeKey(alias));
      if (!matches || !matches.length) {
        continue;
      }

      if (preferPercent) {
        const percentMatch = [...matches].reverse().find((entry) => entry.value.includes('%'));
        if (percentMatch) {
          return percentMatch;
        }
      }

      const lastNonEmpty = [...matches].reverse().find((entry) => String(entry.value ?? '').trim().length > 0);
      if (lastNonEmpty) {
        return lastNonEmpty;
      }
    }

    return null;
  }

  private fieldAliasesFor(kind: ResearchAssetKind): Record<string, string[]> {
    if (kind === 'etf') {
      return {
        Precio: ['Price', 'Precio'],
        RSI: ['RSI', 'RSI (14)'],
        SMA20: ['SMA20'],
        SMA50: ['SMA50'],
        SMA200: ['SMA200'],
        '52W High': ['52W High'],
        '52W Low': ['52W Low'],
        'Perf Month': ['Perf Month'],
        'Perf Quarter': ['Perf Quarter'],
        'Perf YTD': ['Perf YTD'],
        'Perf Year': ['Perf Year']
      };
    }

    if (kind === 'crypto') {
      return {
        Precio: ['Price', 'Precio'],
        RSI: ['RSI', 'RSI (14)'],
        SMA20: ['SMA20'],
        SMA50: ['SMA50'],
        SMA200: ['SMA200'],
        '52W High': ['52W High'],
        '52W Low': ['52W Low'],
        'Perf Month': ['Perf Month'],
        'Perf Quarter': ['Perf Quarter'],
        'Perf YTD': ['Perf YTD'],
        'Perf Year': ['Perf Year']
      };
    }

    return {
      Precio: ['Price', 'Precio'],
      'Target Price': ['Target Price'],
      'P/E': ['P/E'],
      'Forward P/E': ['Forward P/E'],
      PEG: ['PEG'],
      ROE: ['ROE'],
      ROIC: ['ROIC'],
      'Debt/Eq': ['Debt/Eq', 'Debt / Eq', 'Debt/Eq.'],
      'Operating Margin': ['Operating Margin', 'Oper. Margin'],
      'Profit Margin': ['Profit Margin'],
      'EPS Y/Y': ['EPS Y/Y TTM', 'EPS Y/Y', 'EPS Q/Q'],
      'Sales Y/Y': ['Sales Y/Y TTM', 'Sales Y/Y', 'Sales Q/Q'],
      'EPS next Y': ['EPS next Y'],
      'EPS next 5Y': ['EPS next 5Y'],
      RSI: ['RSI', 'RSI (14)'],
      SMA20: ['SMA20'],
      SMA50: ['SMA50'],
      SMA200: ['SMA200'],
      '52W High': ['52W High'],
      '52W Low': ['52W Low'],
      'Perf Month': ['Perf Month'],
      'Perf Quarter': ['Perf Quarter'],
      'Perf YTD': ['Perf YTD'],
      'Perf Year': ['Perf Year']
    };
  }

  private knownKeysFor(kind: ResearchAssetKind, fieldAliases: Record<string, string[]>): Set<string> {
    const known = new Set<string>();
    for (const aliases of Object.values(fieldAliases)) {
      for (const alias of aliases) {
        known.add(this.normalizeKey(alias));
      }
    }

    for (const extra of this.commonKnownKeys(kind)) {
      known.add(this.normalizeKey(extra));
    }

    return known;
  }

  private commonKnownKeys(kind: ResearchAssetKind): string[] {
    const extras = [
      'Index',
      'Market Cap',
      'Enterprise Value',
      'Income',
      'Sales',
      'Book/sh',
      'Cash/sh',
      'Dividend Est.',
      'Dividend TTM',
      'Payout',
      'Employees',
      'IPO',
      'P/S',
      'P/B',
      'P/C',
      'P/FCF',
      'EV/EBITDA',
      'EV/Sales',
      'Quick Ratio',
      'Current Ratio',
      'LT Debt/Eq',
      'Option/Short',
      'EPS (ttm)',
      'EPS next Q',
      'EPS this Y',
      'EPS past 3/5Y',
      'Sales past 3/5Y',
      'EPS Q/Q',
      'Sales Q/Q',
      'Earnings',
      'EPS/Sales Surpr.',
      'Insider Own',
      'Insider Trans',
      'Inst Own',
      'Inst Trans',
      'ROA',
      'Gross Margin',
      'Trades',
      'Shs Outstand',
      'Shs Float',
      'Short Float',
      'Short Ratio',
      'Short Interest',
      'Volatility',
      'ATR (14)',
      'Beta',
      'Rel Volume',
      'Avg Volume',
      'Volume',
      'Perf Week',
      'Perf Half Y',
      'Perf 3Y',
      'Perf 5Y',
      'Perf 10Y',
      'Recom',
      'Prev Close',
      'Change'
    ];

    if (kind === 'stock') {
      return extras;
    }

    return extras;
  }

  private shouldPreferPercent(fieldLabel: string): boolean {
    return fieldLabel === 'EPS next Y'
      || fieldLabel === 'EPS next 5Y'
      || fieldLabel === 'EPS Y/Y'
      || fieldLabel === 'Sales Y/Y'
      || fieldLabel.startsWith('Perf ');
  }

  private normalizeKey(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private normalizeSymbol(value: string): string {
    return String(value ?? '').trim().toUpperCase();
  }
}
