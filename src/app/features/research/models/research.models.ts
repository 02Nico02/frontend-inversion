export type ResearchAssetKind = 'stock' | 'etf' | 'arg_bond' | 'crypto' | 'manual';

export interface ResearchAssetField {
  label: string;
  value: string;
}

export interface ResearchAssetItem {
  id: string;
  portfolioSymbol: string;
  querySymbol: string;
  kind: ResearchAssetKind;
  assetType?: string;
  sector?: string;
  region?: string;
  source: 'manual' | 'alpha_vantage' | 'coingecko' | 'mixed';
  fields: ResearchAssetField[];
  notes?: string;
  updatedAt: string;
}

export interface ResearchTemplateDefinition {
  kind: ResearchAssetKind;
  label: string;
  description: string;
  fields: string[];
}
