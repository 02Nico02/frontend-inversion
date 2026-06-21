import { TestBed } from '@angular/core/testing';

import { CurrencyMapperService } from './currency-mapper.service';
import { DataNormalizationService } from './data-normalization.service';
import { PrivacyModeService } from './privacy-mode.service';

describe('DataNormalizationService', () => {
  const privacyMode = { enabled: false };
  let service: DataNormalizationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CurrencyMapperService,
        DataNormalizationService,
        {
          provide: PrivacyModeService,
          useValue: privacyMode
        }
      ]
    });
    service = TestBed.inject(DataNormalizationService);
  });

  it('normalizes headers, symbols and aliases', () => {
    expect(service.normalizeHeader('  Variacion %  ')).toBe('VARIACION %');
    expect(service.normalizeHeader('minimo esperado')).toBe('MINIMO ESPERADO');
    expect(service.normalizeSymbol('aapl')).toBe('AAPL');
    expect(service.normalizeCurrency('ARS')).toBe('ARS');
    expect(service.normalizeCurrency('U$S')).toBe('USD');
    expect(service.normalizeCurrency('EUR')).toBeNull();
    expect(service.normalizeCurrencyOrUnknown('EUR')).toBe('UNKNOWN');
  });

  it('picks values by aliases and tokens', () => {
    const row = {
      'FECHA COMP.': '2025-06-12',
      'PRECIO OBJETIVO': 1500,
      'TOTAL INV': '$ 1.234,56'
    };

    expect(service.pickValue(row, ['Fecha compra', 'FECHA COMP.'])).toBe('2025-06-12');
    expect(service.pickValueByTokens(row, ['PRECIO', 'OBJETIVO'])).toBe(1500);
    expect(service.pickValueByTokens(row, ['TOTAL', 'INV'])).toBe('$ 1.234,56');
  });

  it('parses numbers, percentages and dates safely', () => {
    expect(service.asNumber('$ 1.234,56')).toBeCloseTo(1234.56, 2);
    expect(service.asPercent('12,5%')).toBeCloseTo(12.5, 2);
    expect(service.asPercentByColumn('0.75', 'VARIACION %')).toBeCloseTo(0.75, 2);

    const serialDate = service.asDate(45663);
    expect(serialDate?.toISOString().slice(0, 10)).toBe('2025-01-06');

    const isoDate = service.asDate('2025-06-12');
    expect(isoDate?.toISOString().slice(0, 10)).toBe('2025-06-12');

    const objectDate = new Date(Date.UTC(2025, 5, 12));
    expect(service.asDate(objectDate)).toBe(objectDate);
    expect(service.asDate(null)).toBeNull();
    expect(service.asDate(undefined)).toBeNull();
    expect(service.asDate('')).toBeNull();
    expect(service.asDate('not-a-date')).toBeNull();
  });
});
