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
    const pendingOrders = service.expectations.find((item) => item.key === 'pendingOrders');

    expect(operations?.primaryName).toBe('Tabla6');
    expect(operations?.expectedColumns).toContain('ESPECIE');
    expect(operations?.expectedColumns).toContain('TOTAL');
    expect(strategicSplit?.primaryName).toBe('Tabla35');
    expect(strategicSplit?.expectedColumns).toContain('MONTO JUB. AR');
    expect(strategicSplit?.expectedColumns).toContain('MONTO AHOR. USD');
    expect(pendingOrders?.primaryName).toBe('Tabla_OrdenesPendientes');
    expect(pendingOrders?.critical).toBeFalse();
    expect(pendingOrders?.expectedColumns).toEqual(['ESPECIE', 'Cant', 'PRECIO']);
  });

  it('reports validation findings for critical and optional tables', () => {
    const findings = service.buildValidationFindings([
      {
        name: 'Tabla6',
        displayName: 'Tabla6',
        sheetName: 'Hoja1',
        sheetIndex: 1,
        ref: 'A1',
        columns: ['ID', 'Fecha', 'ESPECIE', 'MONEDA'],
        rowCount: 10
      },
      {
        name: 'TablaPosiciones',
        displayName: 'TablaPosiciones',
        sheetName: 'Hoja2',
        sheetIndex: 2,
        ref: 'A1',
        columns: ['ESPECIE', 'MONEDA', 'TIPO', 'CANTIDAD', 'TOTAL INV', 'PRECIO ACT', 'TOTAL ACTUAL', 'RESULTADO $', 'RESULTADO %', 'PRECIO PROM'],
        rowCount: 0
      }
    ]);

    const operations = findings.find((item) => item.key === 'operations');
    const positions = findings.find((item) => item.key === 'positions');
    const history = findings.find((item) => item.key === 'history');

    expect(operations?.found).toBeTrue();
    expect(operations?.severity).toBe('warning');
    expect(positions?.found).toBeTrue();
    expect(positions?.rowCount).toBe(0);
    expect(history?.found).toBeFalse();
    expect(history?.severity).toBe('error');
  });

  it('handles an empty workbook with controlled findings', () => {
    const findings = service.buildValidationFindings([]);
    const criticals = findings.filter((item) => item.critical);

    expect(criticals.every((item) => item.severity === 'error')).toBeTrue();
    expect(findings.some((item) => item.key === 'operations' && item.found)).toBeFalse();
  });

  it('reports optional pending orders table as non-critical when missing', () => {
    const findings = service.buildValidationFindings([]);
    const pendingOrders = findings.find((item) => item.key === 'pendingOrders');

    expect(pendingOrders?.critical).toBeFalse();
    expect(pendingOrders?.severity).toBe('warning');
    expect(pendingOrders?.found).toBeFalse();
  });
});
