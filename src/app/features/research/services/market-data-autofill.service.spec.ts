import { TestBed } from '@angular/core/testing';
import { ResearchAssetItem } from '../models/research.models';
import { ResearchProviderSettingsService } from './research-provider-settings.service';
import { AlphaVantageService } from './alpha-vantage.service';
import { CoinGeckoService } from './coingecko.service';
import { MarketDataAutofillService } from './market-data-autofill.service';

describe('MarketDataAutofillService', () => {
  let service: MarketDataAutofillService;
  let alphaVantage: jasmine.SpyObj<AlphaVantageService>;
  let coinGecko: jasmine.SpyObj<CoinGeckoService>;

  beforeEach(() => {
    alphaVantage = jasmine.createSpyObj<AlphaVantageService>('AlphaVantageService', ['autofill']);
    coinGecko = jasmine.createSpyObj<CoinGeckoService>('CoinGeckoService', ['autofill']);

    TestBed.configureTestingModule({
      providers: [
        MarketDataAutofillService,
        ResearchProviderSettingsService,
        { provide: AlphaVantageService, useValue: alphaVantage },
        { provide: CoinGeckoService, useValue: coinGecko }
      ]
    });

    service = TestBed.inject(MarketDataAutofillService);
  });

  it('routes stock items to Alpha Vantage and crypto items to CoinGecko', async () => {
    alphaVantage.autofill.and.resolveTo({
      provider: 'alpha_vantage',
      fetchedAt: '2026-07-18T12:00:00.000Z',
      fields: { Precio: '123' },
      warnings: [],
      errors: []
    });
    coinGecko.autofill.and.resolveTo({
      provider: 'coingecko',
      fetchedAt: '2026-07-18T12:00:00.000Z',
      fields: { Precio: '456' },
      warnings: [],
      errors: []
    });

    const stockItem = { id: '1', portfolioSymbol: 'MSFT', querySymbol: 'MSFT', kind: 'stock' } as ResearchAssetItem;
    const cryptoItem = { id: '2', portfolioSymbol: 'BTC', querySymbol: 'BTC', kind: 'crypto' } as ResearchAssetItem;

    await service.autofill(stockItem, false, { alphaVantageApiKey: 'alpha', coinGeckoApiKey: '' });
    await service.autofill(cryptoItem, false, { alphaVantageApiKey: '', coinGeckoApiKey: '' });

    expect(alphaVantage.autofill).toHaveBeenCalledWith('MSFT', 'alpha');
    expect(coinGecko.autofill).toHaveBeenCalledWith('BTC', '');
  });

  it('rejects unsupported kinds', async () => {
    const item = { id: '3', portfolioSymbol: 'AE38', querySymbol: 'AE38', kind: 'arg_bond' } as ResearchAssetItem;

    const result = await service.autofill(item, false, { alphaVantageApiKey: '', coinGeckoApiKey: '' });

    expect(result.errors[0]).toContain('bonos argentinos');
  });
});
