import { TestBed } from '@angular/core/testing';
import { ResearchProviderSettingsService } from './research-provider-settings.service';

describe('ResearchProviderSettingsService', () => {
  let service: ResearchProviderSettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [ResearchProviderSettingsService]
    });
    service = TestBed.inject(ResearchProviderSettingsService);
  });

  it('loads, saves and clears settings locally', () => {
    const settings = {
      alphaVantageApiKey: 'alpha-key',
      coinGeckoApiKey: 'cg-key'
    };

    service.save(settings);

    expect(service.load()).toEqual(settings);
    expect(service.hasAlphaVantageKey(service.load())).toBeTrue();
    expect(service.hasCoinGeckoKey(service.load())).toBeTrue();

    expect(service.clear()).toEqual({ alphaVantageApiKey: '', coinGeckoApiKey: '' });
    expect(service.load()).toEqual({ alphaVantageApiKey: '', coinGeckoApiKey: '' });
  });
});
