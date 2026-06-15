import { Injectable } from '@angular/core';
import { PrivacyModeService } from './privacy-mode.service';

export type CanonicalCurrency = 'ARS' | 'USD' | 'UNKNOWN';

@Injectable({ providedIn: 'root' })
export class CurrencyMapperService {
  constructor(private readonly privacyMode: PrivacyModeService) {}

  normalizeCurrency(value: unknown): CanonicalCurrency {
    const text = String(value ?? '').trim().toUpperCase();
    if (!text) {
      return 'UNKNOWN';
    }
    if (['AR', 'ARS', '$', 'PESO', 'PESOS', 'ARG', 'ARGENTINA'].includes(text)) {
      return 'ARS';
    }
    if (['US', 'USD', 'US$', 'U$S', 'DOLAR', 'DOLARES', 'DOLAR USA', 'DOLARES USA'].includes(text)) {
      return 'USD';
    }
    return 'UNKNOWN';
  }

  getCurrencyLabel(currency: CanonicalCurrency | string | null | undefined): string {
    switch (this.normalizeCurrency(currency)) {
      case 'ARS':
        return 'ARS';
      case 'USD':
        return 'USD';
      default:
        return 'Sin moneda';
    }
  }

  getCurrencySymbol(currency: CanonicalCurrency | string | null | undefined): string {
    switch (this.normalizeCurrency(currency)) {
      case 'ARS':
        return '$';
      case 'USD':
        return 'US$';
      default:
        return '';
    }
  }

  formatCurrency(value: number | null | undefined, currency: CanonicalCurrency | string | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    const normalized = this.normalizeCurrency(currency);
    const symbol = this.getCurrencySymbol(normalized);
    const formatted = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return symbol ? `${symbol} ${formatted}` : formatted;
  }

  formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    return `${new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)}%`;
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    if (this.privacyMode.enabled) {
      return 'Oculto';
    }
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}
