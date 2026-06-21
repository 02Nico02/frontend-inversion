import { TestBed } from '@angular/core/testing';

import { CurrencyMapperService } from './currency-mapper.service';
import { PrivacyModeService } from './privacy-mode.service';

describe('CurrencyMapperService', () => {
  const privacyMode = { enabled: false };
  let service: CurrencyMapperService;

  beforeEach(() => {
    privacyMode.enabled = false;
    TestBed.configureTestingModule({
      providers: [
        CurrencyMapperService,
        {
          provide: PrivacyModeService,
          useValue: privacyMode
        }
      ]
    });
    service = TestBed.inject(CurrencyMapperService);
  });

  it('normalizes ARS aliases', () => {
    expect(service.normalizeCurrency('AR')).toBe('ARS');
    expect(service.normalizeCurrency('ARS')).toBe('ARS');
    expect(service.normalizeCurrency('$')).toBe('ARS');
    expect(service.normalizeCurrency('Pesos')).toBe('ARS');
  });

  it('normalizes USD aliases', () => {
    expect(service.normalizeCurrency('US')).toBe('USD');
    expect(service.normalizeCurrency('USD')).toBe('USD');
    expect(service.normalizeCurrency('U$S')).toBe('USD');
    expect(service.normalizeCurrency('Dolares')).toBe('USD');
  });

  it('falls back to UNKNOWN for unrecognized values', () => {
    expect(service.normalizeCurrency(null)).toBe('UNKNOWN');
    expect(service.normalizeCurrency(undefined)).toBe('UNKNOWN');
    expect(service.normalizeCurrency('')).toBe('UNKNOWN');
    expect(service.normalizeCurrency('EUR')).toBe('UNKNOWN');
  });

  it('formats values according to privacy mode', () => {
    expect(service.formatCurrency(1234.5, 'ARS')).toBe('$ 1.234,50');
    expect(service.formatPercentage(12.34)).toBe('12,34%');
    expect(service.formatNumber(1234.5)).toBe('1.234,50');

    privacyMode.enabled = true;

    expect(service.formatCurrency(1234.5, 'ARS')).toBe('Oculto');
    expect(service.formatPercentage(12.34)).toBe('Oculto');
    expect(service.formatNumber(1234.5)).toBe('Oculto');
  });
});
