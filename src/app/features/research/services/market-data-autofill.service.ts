import { Injectable } from '@angular/core';
import { ResearchAssetItem } from '../models/research.models';
import { ResearchAutofillRequest, ResearchAutofillResult, ResearchProviderSettings } from '../models/research-provider.models';
import { AlphaVantageService } from './alpha-vantage.service';
import { CoinGeckoService } from './coingecko.service';
import { ResearchProviderSettingsService } from './research-provider-settings.service';

@Injectable({ providedIn: 'root' })
export class MarketDataAutofillService {
  constructor(
    private readonly alphaVantage: AlphaVantageService,
    private readonly coinGecko: CoinGeckoService,
    private readonly settingsService: ResearchProviderSettingsService
  ) {}

  loadSettings(): ResearchProviderSettings {
    return this.settingsService.load();
  }

  saveSettings(settings: ResearchProviderSettings): void {
    this.settingsService.save(settings);
  }

  clearSettings(): ResearchProviderSettings {
    return this.settingsService.clear();
  }

  canAutofill(item: ResearchAssetItem): boolean {
    return item.kind === 'stock' || item.kind === 'etf' || item.kind === 'crypto';
  }

  providerLabel(item: ResearchAssetItem): string {
    if (item.kind === 'stock' || item.kind === 'etf') {
      return 'Alpha Vantage';
    }
    if (item.kind === 'crypto') {
      return 'CoinGecko';
    }
    return 'No disponible';
  }

  async autofill(item: ResearchAssetItem, overwrite: boolean, settings = this.settingsService.load()): Promise<ResearchAutofillResult> {
    const request: ResearchAutofillRequest = {
      portfolioSymbol: item.portfolioSymbol,
      querySymbol: item.querySymbol || item.portfolioSymbol,
      kind: item.kind,
      overwrite
    };

    if (!this.canAutofill(item)) {
      return this.unsupportedResult(item);
    }

    if (item.kind === 'stock' || item.kind === 'etf') {
      return this.alphaVantage.autofill(request.querySymbol, settings.alphaVantageApiKey);
    }

    return this.coinGecko.autofill(request.querySymbol, settings.coinGeckoApiKey);
  }

  private unsupportedResult(item: ResearchAssetItem): ResearchAutofillResult {
    return {
      provider: 'alpha_vantage',
      fetchedAt: new Date().toISOString(),
      fields: {},
      warnings: [],
      errors: item.kind === 'arg_bond'
        ? ['Autocompletado no disponible para bonos argentinos en este MVP.']
        : ['Autocompletado no disponible para plantilla manual.']
    };
  }
}
