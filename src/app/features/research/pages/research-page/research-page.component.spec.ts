import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { PortfolioCalculatorService } from '../../../../core/services/portfolio-calculator.service';
import { FileDownloadService } from '../../../../core/services/file-download.service';
import { PortfolioStateService } from '../../../../core/services/portfolio-state.service';
import { buildPortfolioAppState, buildPortfolioPosition } from '../../../../core/testing/portfolio-test-builders';
import { ResearchExportService } from '../../services/research-export.service';
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
});

