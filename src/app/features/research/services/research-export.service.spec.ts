import { TestBed } from '@angular/core/testing';
import { ResearchAssetItem } from '../models/research.models';
import { ResearchExportService } from './research-export.service';
import { ResearchTemplateService } from './research-template.service';

describe('ResearchExportService', () => {
  let service: ResearchExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ResearchExportService, ResearchTemplateService]
    });
    service = TestBed.inject(ResearchExportService);
  });

  it('builds markdown with the selected species and empty fields', () => {
    const items: ResearchAssetItem[] = [
      {
        id: '1',
        portfolioSymbol: 'MSFT',
        querySymbol: 'MSFT',
        kind: 'stock',
        source: 'manual',
        fields: [{ label: 'Precio', value: '123' }],
        notes: '',
        updatedAt: '2026-07-18T12:30:00.000Z'
      }
    ];

    const markdown = service.buildMarkdown(items, new Date('2026-07-18T12:30:00Z'));

    expect(markdown).toContain('# Datos actualizados de especies para ChatGPT');
    expect(markdown).toContain('## MSFT');
    expect(markdown).toContain('Precio: 123');
  });

  it('builds a filename with iso date', () => {
    expect(service.buildFilename(new Date('2026-07-18T12:30:00Z'))).toBe('datos-gpt-especies-2026-07-18.md');
  });
});

