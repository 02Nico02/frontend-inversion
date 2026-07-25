import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { buildPortfolioAppState, buildPortfolioPosition } from '../../../../core/testing/portfolio-test-builders';
import { ResearchExportService } from '../../services/research-export.service';
import { ResearchTextImportService } from '../../services/research-text-import.service';
import { ResearchTemplateService } from '../../services/research-template.service';
import { ResearchPageComponent } from './research-page.component';

describe('ResearchPageComponent', () => {
  let fixture: ComponentFixture<ResearchPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResearchPageComponent, RouterTestingModule],
      providers: [
        ResearchTemplateService,
        ResearchExportService,
        ResearchTextImportService,
        { provide: FileDownloadService, useValue: { downloadText: jasmine.createSpy('downloadText'), copyText: jasmine.createSpy('copyText').and.resolveTo(true) } },
        { provide: PortfolioCalculatorService, useValue: { enrichPositions: (positions: unknown[]) => positions } },
        { provide: PortfolioStateService, useValue: { snapshot: buildPortfolioAppState({ dataset: { positions: [], classifications: [] } as any }), state$: of(buildPortfolioAppState({ dataset: { positions: [], classifications: [] } as any })) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResearchPageComponent);
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('updates an existing item when importing text for the same symbol', async () => {
    const component = fixture.componentInstance;
    component.selectedAssets = [{
      id: 'amd-1',
      portfolioSymbol: 'AMD',
      querySymbol: 'AMD',
      kind: 'stock',
      source: 'manual',
      fields: [
        { label: 'Precio', value: '' },
        { label: 'Target Price', value: '' },
        { label: 'P/E', value: '185.46' },
        { label: 'Forward P/E', value: '' },
        { label: 'PEG', value: '' },
        { label: 'ROE', value: '' },
        { label: 'ROIC', value: '' },
        { label: 'Debt/Eq', value: '' },
        { label: 'Operating Margin', value: '' },
        { label: 'Profit Margin', value: '' },
        { label: 'EPS Y/Y', value: '' },
        { label: 'Sales Y/Y', value: '' },
        { label: 'EPS next Y', value: '' },
        { label: 'EPS next 5Y', value: '' },
        { label: 'RSI', value: '' },
        { label: 'SMA20', value: '' },
        { label: 'SMA50', value: '' },
        { label: 'SMA200', value: '' },
        { label: '52W High', value: '' },
        { label: '52W Low', value: '' },
        { label: 'Perf Month', value: '' },
        { label: 'Perf Quarter', value: '' },
        { label: 'Perf YTD', value: '' },
        { label: 'Perf Year', value: '' }
      ],
      updatedAt: new Date('2026-07-24T00:00:00Z').toISOString()
    }];
    component.textImportSymbol = 'AMD';
    component.textImportKind = 'stock';
    component.textImportRawText = [
      'Price',
      '521.95',
      'Target Price',
      '571.18',
      'RSI (14)',
      '50.04',
      '52W High',
      '584.73 -10.74%',
      'Perf Month',
      '0.43%',
      'Perf Quarter',
      '70.95%',
      'Perf YTD',
      '143.72%',
      'Perf Year',
      '221.95%'
    ].join('\n');

    await component.addFromText();

    expect(component.selectedAssets.length).toBe(1);
    expect(component.selectedAssets[0].fields.find((field) => field.label === 'Precio')?.value).toBe('521.95');
    expect(component.selectedAssets[0].fields.find((field) => field.label === 'Target Price')?.value).toBe('571.18');
    expect(component.selectedAssets[0].fields.find((field) => field.label === 'P/E')?.value).toBe('185.46');
    expect(component.textImportStatus).toBe('Especie existente actualizada desde texto.');
    expect(component.expandedIds.has('amd-1')).toBeTrue();
  });
});
