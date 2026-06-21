import { TestBed } from '@angular/core/testing';

import { PortfolioValidationService } from './portfolio-validation.service';
import { DataNormalizationService } from './data-normalization.service';
import { CurrencyMapperService } from './currency-mapper.service';
import { PrivacyModeService } from './privacy-mode.service';
import { buildPortfolioDataset, buildWorkbookValidationReport, buildPortfolioPosition, buildInvestmentOperation, buildClassification, buildHistoricalPrice, buildManualAlert } from '../testing/portfolio-test-builders';

describe('PortfolioValidationService', () => {
  const privacyMode = { enabled: false };
  let service: PortfolioValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CurrencyMapperService,
        DataNormalizationService,
        PortfolioValidationService,
        {
          provide: PrivacyModeService,
          useValue: privacyMode
        }
      ]
    });
    service = TestBed.inject(PortfolioValidationService);
  });

  it('adds workbook validation warnings derived from the dataset snapshot', () => {
    const dataset = buildPortfolioDataset({
      operations: [buildInvestmentOperation({ symbol: 'TX26' })],
      positions: [buildPortfolioPosition({ symbol: 'TX26', currentPrice: null })],
      classifications: [],
      historicalPrices: [],
      manualAlerts: [buildManualAlert({ symbol: 'TX26' })]
    });
    const report = buildWorkbookValidationReport({
      uncategorizedSymbols: [],
      symbolsWithoutHistory: [],
      symbolsWithoutCurrentPrice: []
    });

    const validated = service.validateDataset(report, dataset);

    expect(validated.uncategorizedSymbols).toContain('TX26');
    expect(validated.symbolsWithoutHistory).toContain('TX26');
    expect(validated.symbolsWithoutCurrentPrice).toContain('TX26');
  });

  it('keeps existing report values while merging new findings', () => {
    const report = buildWorkbookValidationReport({
      uncategorizedSymbols: ['OLD'],
      symbolsWithoutHistory: ['HIST'],
      symbolsWithoutCurrentPrice: ['PRICE']
    });
    const dataset = buildPortfolioDataset({
      operations: [],
      positions: [],
      classifications: [],
      historicalPrices: [],
      manualAlerts: []
    });

    const validated = service.validateDataset(report, dataset);

    expect(validated.uncategorizedSymbols).toContain('OLD');
    expect(validated.symbolsWithoutHistory).toContain('HIST');
    expect(validated.symbolsWithoutCurrentPrice).toContain('PRICE');
  });
});
