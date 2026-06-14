import { Injectable } from '@angular/core';
import { MarketSignal } from '../models/portfolio.models';

@Injectable({ providedIn: 'root' })
export class SignalMapperService {
  byPeriod(signals: MarketSignal[], period: '5D' | '30D'): MarketSignal[] {
    return signals.filter((signal) => signal.period === period);
  }

  byType(signals: MarketSignal[], type: 'caida' | 'recuperacion'): MarketSignal[] {
    return signals.filter((signal) => signal.signalType === type);
  }
}
