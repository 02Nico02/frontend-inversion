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

  it('exports SMA as percentage distance and keeps RSI as numeric value', async () => {
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
      'Time Series (Daily)': thisBuildSeries(200)
    }), { status: 200 });

    spyOn(globalThis, 'fetch').and.returnValues(
      Promise.resolve(overview as Response),
      Promise.resolve(series as Response)
    );

    const result = await service.autofill('QQQ', 'alpha-key');

    expect(result.errors).toEqual([]);
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

  it('adds a warning when fundamentals are missing', async () => {
    const overview = new Response(JSON.stringify({
      AnalystTargetPrice: '250'
    }), { status: 200 });

    const series = new Response(JSON.stringify({
      'Time Series (Daily)': thisBuildSeries(210)
    }), { status: 200 });

    spyOn(globalThis, 'fetch').and.returnValues(
      Promise.resolve(overview as Response),
      Promise.resolve(series as Response)
    );

    const result = await service.autofill('MSFT', 'alpha-key');

    expect(result.warnings).toContain('Alpha Vantage no devolvió algunos campos fundamentales; se dejaron vacíos.');
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
      '6. volume': '1000',
      '7. dividend amount': '0',
      '8. split coefficient': '1'
    };
  }

  return series;
}
