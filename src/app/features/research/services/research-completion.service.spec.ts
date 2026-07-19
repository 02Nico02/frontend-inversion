import { TestBed } from '@angular/core/testing';
import { ResearchAssetItem } from '../models/research.models';
import { ResearchCompletionService } from './research-completion.service';

describe('ResearchCompletionService', () => {
  let service: ResearchCompletionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ResearchCompletionService]
    });
    service = TestBed.inject(ResearchCompletionService);
  });

  it('summarizes completion and missing fields', () => {
    const item = {
      id: '1',
      portfolioSymbol: 'MSFT',
      querySymbol: 'MSFT',
      kind: 'stock',
      source: 'manual',
      fields: [
        { label: 'Precio', value: '123' },
        { label: 'P/E', value: '' }
      ],
      notes: '',
      updatedAt: '2026-07-18T12:30:00.000Z'
    } as ResearchAssetItem;

    const summary = service.summarize(item);

    expect(summary.completedFields).toBe(1);
    expect(summary.totalFields).toBe(2);
    expect(summary.completionPercent).toBe(50);
    expect(summary.status).toBe('parcial');
    expect(summary.missingFields).toEqual(['P/E']);
  });

  it('summarizes many items', () => {
    const items = [
      {
        id: '1',
        portfolioSymbol: 'MSFT',
        querySymbol: 'MSFT',
        kind: 'stock',
        source: 'manual',
        fields: [{ label: 'Precio', value: '123' }],
        notes: '',
        updatedAt: '2026-07-18T12:30:00.000Z'
      },
      {
        id: '2',
        portfolioSymbol: 'NVDA',
        querySymbol: 'NVDA',
        kind: 'stock',
        source: 'manual',
        fields: [{ label: 'Precio', value: '' }],
        notes: '',
        updatedAt: '2026-07-18T12:30:00.000Z'
      }
    ] as ResearchAssetItem[];

    const summary = service.summarizeMany(items);

    expect(summary.completedFields).toBe(1);
    expect(summary.totalFields).toBe(2);
    expect(summary.status).toBe('parcial');
  });
});
