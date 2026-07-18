import { TestBed } from '@angular/core/testing';
import { buildPortfolioPosition } from '../../../core/testing/portfolio-test-builders';
import { ResearchTemplateService } from './research-template.service';

describe('ResearchTemplateService', () => {
  let service: ResearchTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ResearchTemplateService] });
    service = TestBed.inject(ResearchTemplateService);
  });

  it('detects stock templates from CEDEAR/acción positions', () => {
    const kind = service.detectKind(buildPortfolioPosition({ assetType: 'CEDEAR', positionType: 'Accion' }));
    expect(kind).toBe('stock');
  });

  it('detects ETF templates from type', () => {
    const kind = service.detectKind(buildPortfolioPosition({ assetType: 'ETF', positionType: 'ETF' }));
    expect(kind).toBe('etf');
  });

  it('detects crypto templates from sector', () => {
    const kind = service.detectKind(buildPortfolioPosition({ assetType: 'Otro', sector: 'Criptomonedas' }));
    expect(kind).toBe('crypto');
  });

  it('hydrates missing fields for a template', () => {
    const item = service.hydrateItem({
      portfolioSymbol: 'MSFT',
      kind: 'stock',
      fields: [{ label: 'Precio', value: '100' }]
    });

    expect(item.fields[0].value).toBe('100');
    expect(item.fields.some((field) => field.label === 'Target Price')).toBeTrue();
  });
});
