import { TestBed } from '@angular/core/testing';

import { WorkbookMappingService } from './workbook-mapping.service';

describe('WorkbookMappingService', () => {
  let service: WorkbookMappingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WorkbookMappingService]
    });
    service = TestBed.inject(WorkbookMappingService);
  });

  it('declares the critical workbook tables expected by the app', () => {
    const critical = service.expectations.filter((item) => item.critical);
    const criticalKeys = critical.map((item) => item.key);

    expect(criticalKeys).toContain('operations');
    expect(criticalKeys).toContain('positions');
    expect(criticalKeys).toContain('history');
    expect(criticalKeys).toContain('dailyBalance');
  });

  it('includes the core tables and their expected columns', () => {
    const operations = service.expectations.find((item) => item.key === 'operations');
    const strategicSplit = service.expectations.find((item) => item.key === 'strategicSplit');

    expect(operations?.primaryName).toBe('Tabla6');
    expect(operations?.expectedColumns).toContain('ESPECIE');
    expect(operations?.expectedColumns).toContain('TOTAL');
    expect(strategicSplit?.primaryName).toBe('Tabla35');
    expect(strategicSplit?.expectedColumns).toContain('MONTO JUB. AR');
    expect(strategicSplit?.expectedColumns).toContain('MONTO AHOR. USD');
  });
});
