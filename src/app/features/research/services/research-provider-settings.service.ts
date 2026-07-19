import { Injectable } from '@angular/core';
import { ResearchProviderSettings } from '../models/research-provider.models';

const STORAGE_KEY = 'frontend-inversion.research-provider-settings';

const DEFAULT_SETTINGS: ResearchProviderSettings = {
  alphaVantageApiKey: '',
  coinGeckoApiKey: ''
};

@Injectable({ providedIn: 'root' })
export class ResearchProviderSettingsService {
  load(): ResearchProviderSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }
      const parsed = JSON.parse(raw) as Partial<ResearchProviderSettings>;
      return {
        alphaVantageApiKey: String(parsed.alphaVantageApiKey ?? '').trim(),
        coinGeckoApiKey: String(parsed.coinGeckoApiKey ?? '').trim()
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  save(settings: ResearchProviderSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.normalize(settings)));
    } catch {
      // ignore storage issues
    }
  }

  clear(): ResearchProviderSettings {
    const empty = { ...DEFAULT_SETTINGS };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage issues
    }
    return empty;
  }

  hasAlphaVantageKey(settings: ResearchProviderSettings): boolean {
    return String(settings.alphaVantageApiKey ?? '').trim().length > 0;
  }

  hasCoinGeckoKey(settings: ResearchProviderSettings): boolean {
    return String(settings.coinGeckoApiKey ?? '').trim().length > 0;
  }

  private normalize(settings: ResearchProviderSettings): ResearchProviderSettings {
    return {
      alphaVantageApiKey: String(settings.alphaVantageApiKey ?? '').trim(),
      coinGeckoApiKey: String(settings.coinGeckoApiKey ?? '').trim()
    };
  }
}
