import { TestBed } from '@angular/core/testing';
import { AlphaVantageService } from './alpha-vantage.service';

describe('AlphaVantageService', () => {
  let service: AlphaVantageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AlphaVantageService]
    });
    service = TestBed.inject(AlphaVantageService);
  });

  it('exports fundamentals and technical fields when both endpoints respond', async () => {
    const overview = new Response(JSON.stringify({
      AnalystTargetPrice: '250',
      PERatio: '20',
      ForwardPE: '18',
      PEGRatio: '1.5',
      ReturnOnEquityTTM: '15',
      OperatingMarginTTM: '12',
      ProfitMargin: '10',
      QuarterlyEarningsGrowthYOY: '8',
      QuarterlyRevenueGrowthYOY: '9',
      '52WeekHigh': '220',
      '52WeekLow': '120'
    }), { status: 200 });

    const series = new Response(JSON.stringify({
      'Time Series (Daily)': thisBuildSeries(220)
    }), { status: 200 });

    spyOn(globalThis, 'fetch').and.returnValues(
      Promise.resolve(overview as Response),
      Promise.resolve(series as Response)
    );

    const result = await service.autofill('QQQ', 'alpha-key');

    expect(result.errors).toEqual([]);
    expect(result.fields['Target Price']).toBe('250');
    expect(result.fields['P/E']).toBe('20');
    expect(result.fields['SMA20']).toMatch(/%$/);
    expect(result.fields['SMA50']).toMatch(/%$/);
    expect(result.fields['SMA200']).toMatch(/%$/);
    expect(result.fields['RSI']).toMatch(/^\d+([.,]\d+)?$/);
    expect(result.fields['52W High']).toBeDefined();
    expect(result.fields['52W Low']).toBeDefined();
    expect(result.fields['ROIC']).toBeUndefined();
    expect(result.fields['Debt/Eq']).toBeUndefined();
    expect(result.fields['EPS next Y']).toBeUndefined();
    expect(result.fields['EPS next 5Y']).toBeUndefined();
  });

  it('keeps fundamentals when the historical endpoint returns a premium error', async () => {
    const overview = new Response(JSON.stringify({
      AnalystTargetPrice: '250',
      PERatio: '20',
      ForwardPE: '18',
      PEGRatio: '1.5',
      ReturnOnEquityTTM: '15',
      OperatingMarginTTM: '12',
      ProfitMargin: '10',
      QuarterlyEarningsGrowthYOY: '8',
      QuarterlyRevenueGrowthYOY: '9',
      '52WeekHigh': '220',
      '52WeekLow': '120'
    }), { status: 200 });

    const series = new Response(JSON.stringify({
      Note: 'Premium endpoint'
    }), { status: 200 });

    spyOn(globalThis, 'fetch').and.returnValues(
      Promise.resolve(overview as Response),
      Promise.resolve(series as Response)
    );

    const result = await service.autofill('MSFT', 'alpha-key');

    expect(result.errors).toEqual([]);
    expect(result.fields['Target Price']).toBe('250');
    expect(result.fields['P/E']).toBe('20');
    expect(result.fields['Precio']).toBeUndefined();
    expect(result.fields['SMA20']).toBeUndefined();
    expect(result.warnings).toContain('Premium endpoint');
    expect(result.warnings).toContain('No se pudo obtener historico diario; se completaron solo datos fundamentales disponibles.');
  });

  it('keeps price and technical fields when overview fails but the series responds', async () => {
    const overview = new Response(JSON.stringify({
      Note: 'Overview unavailable'
    }), { status: 200 });

    const series = new Response(JSON.stringify({
      'Time Series (Daily)': thisBuildSeries(220)
    }), { status: 200 });

    spyOn(globalThis, 'fetch').and.returnValues(
      Promise.resolve(overview as Response),
      Promise.resolve(series as Response)
    );

    const result = await service.autofill('GOOGL', 'alpha-key');

    expect(result.errors).toEqual([]);
    expect(result.fields['Precio']).toBeDefined();
    expect(result.fields['SMA20']).toMatch(/%$/);
    expect(result.fields['Target Price']).toBeUndefined();
    expect(result.warnings).toContain('Overview unavailable');
    expect(result.warnings).toContain('No se pudo obtener OVERVIEW; se completaron solo precio, tecnicos y performance.');
  });

  it('reports an error only when both endpoints fail to provide useful data', async () => {
    const overview = new Response(JSON.stringify({
      Note: 'Overview unavailable'
    }), { status: 200 });

    const series = new Response(JSON.stringify({
      Note: 'Premium endpoint'
    }), { status: 200 });

    spyOn(globalThis, 'fetch').and.returnValues(
      Promise.resolve(overview as Response),
      Promise.resolve(series as Response)
    );

    const result = await service.autofill('AAPL', 'alpha-key');

    expect(result.fields).toEqual({});
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

function thisBuildSeries(days: number): Record<string, Record<string, string>> {
  const series: Record<string, Record<string, string>> = {};
  const start = new Date('2025-01-01T00:00:00Z').getTime();

  for (let index = 0; index < days; index += 1) {
    const time = new Date(start + (index * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const close = 100 + index;
    const high = close + 2;
    const low = close - 2;
    series[time] = {
      '1. open': String(close - 1),
      '2. high': String(high),
      '3. low': String(low),
      '4. close': String(close),
      '5. adjusted close': String(close),
      '6. volume': '1000'
    };
  }

  return series;
}
