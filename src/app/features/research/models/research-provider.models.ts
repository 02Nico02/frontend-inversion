import { ResearchAssetKind } from './research.models';

export type ResearchDataSource = 'manual' | 'alpha_vantage' | 'coingecko' | 'mixed';

export interface ResearchProviderSettings {
  alphaVantageApiKey: string;
  coinGeckoApiKey: string;
}

export interface ResearchAutofillResult {
  provider: 'alpha_vantage' | 'coingecko';
  fetchedAt: string;
  fields: Record<string, string>;
  warnings: string[];
  errors: string[];
}

export interface ResearchAutofillRequest {
  portfolioSymbol: string;
  querySymbol: string;
  kind: ResearchAssetKind;
  overwrite: boolean;
}

export interface AutofillUiState {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
}
