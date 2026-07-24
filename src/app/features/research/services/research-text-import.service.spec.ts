import { TestBed } from '@angular/core/testing';
import { ResearchTextImportService } from './research-text-import.service';

describe('ResearchTextImportService', () => {
  let service: ResearchTextImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ResearchTextImportService]
    });
    service = TestBed.inject(ResearchTextImportService);
  });

  it('maps Finviz-style text into stock fields and prefers percentage values for repeated growth keys', () => {
    const preview = service.preview({
      portfolioSymbol: 'AMD',
      querySymbol: 'AMD',
      kind: 'stock',
      rawText: [
        'Price',
        '521.95',
        'Target Price',
        '571.18',
        'P/E',
        '171.31',
        'Forward P/E',
        '38.13',
        'PEG',
        '0.58',
        'ROE',
        '8.06%',
        'ROIC',
        '7.43%',
        'Debt/Eq',
        '0.06',
        'Operating Margin',
        '11.75%',
        'Profit Margin',
        '13.37%',
        'EPS Y/Y TTM',
        '123.87%',
        'Sales Y/Y TTM',
        '34.97%',
        'EPS next Y',
        '13.69',
        'EPS next Y',
        '82.46%',
        'EPS next 5Y',
        '65.83%',
        'RSI (14)',
        '50.04',
        'SMA20',
        '-2.08%',
        'SMA50',
        '2.65%',
        'SMA200',
        '70.75%',
        '52W High',
        '584.73 -10.74%',
        '52W Low',
        '149.22 249.79%',
        'Perf Month',
        '0.43%',
        'Perf Quarter',
        '70.95%',
        'Perf YTD',
        '143.72%',
        'Perf Year',
        '221.95%'
      ].join('\n')
    });

    expect(preview.fields['Precio']).toBe('521.95');
    expect(preview.fields['Target Price']).toBe('571.18');
    expect(preview.fields['P/E']).toBe('171.31');
    expect(preview.fields['ROIC']).toBe('7.43%');
    expect(preview.fields['EPS next Y']).toBe('82.46%');
    expect(preview.fields['Perf Year']).toBe('221.95%');
    expect(preview.matchedKeys).toContain('Precio');
    expect(preview.matchedKeys).toContain('EPS next Y');
  });

  it('creates a complete item from pasted text', () => {
    const item = service.createItem({
      portfolioSymbol: 'AMD',
      querySymbol: 'AMD',
      kind: 'stock',
      rawText: [
        'Price',
        '521.95',
        'P/E',
        '171.31',
        'RSI (14)',
        '50.04'
      ].join('\n')
    });

    expect(item.portfolioSymbol).toBe('AMD');
    expect(item.querySymbol).toBe('AMD');
    expect(item.source).toBe('manual');
    expect(item.fields.find((field) => field.label === 'Precio')?.value).toBe('521.95');
    expect(item.fields.find((field) => field.label === 'P/E')?.value).toBe('171.31');
    expect(item.fields.find((field) => field.label === 'RSI')?.value).toBe('50.04');
  });
});
