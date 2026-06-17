export function parseLocaleNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  const cleaned = text
    .replace(/\$/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9.,-]/g, '');

  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') {
    return null;
  }

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (hasComma && !hasDot) {
    const normalized = cleaned.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDisplayedPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const hasPercentSign = text.includes('%');
  const parsed = parseLocaleNumber(text);
  if (parsed === null) {
    return null;
  }

  if (hasPercentSign) {
    return parsed;
  }

  return parsed;
}

export function parseExcelDecimalPercent(value: unknown): number | null {
  const parsed = parseDisplayedPercent(value);
  if (parsed === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1) {
    return value * 100;
  }

  if (typeof value === 'string' && !value.includes('%') && Math.abs(parsed) <= 1) {
    return parsed * 100;
  }

  return parsed;
}

export function parsePercentByColumn(value: unknown, columnName: string): number | null {
  const column = String(columnName ?? '').trim().toLowerCase();
  if (
    column.includes('variacion') ||
    column.includes('variación') ||
    column.includes('rend') ||
    column.includes('inflacion') ||
    column.includes('inflación') ||
    column.includes('resultado') ||
    column.includes('jubil') ||
    column.includes('ahorro') ||
    column.includes('ratio') ||
    column.includes('tem') ||
    column.includes('tna') ||
    column.includes('top')
  ) {
    return parseDisplayedPercent(value);
  }

  return parseDisplayedPercent(value);
}

export function parseCalendarDailyPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) <= 0.01 ? value * 100 : value;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = parseLocaleNumber(text);
  if (parsed === null) {
    return null;
  }

  if (text.includes('%')) {
    return parsed;
  }

  return Math.abs(parsed) <= 0.01 ? parsed * 100 : parsed;
}

export function parseCalendarIndex(value: unknown): number | null {
  return parseLocaleNumber(value);
}

export function parseCalendarTna(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) <= 1 ? value * 100 : value;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = parseLocaleNumber(text);
  if (parsed === null) {
    return null;
  }

  if (text.includes('%')) {
    return parsed;
  }

  return Math.abs(parsed) <= 1 ? parsed * 100 : parsed;
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(text)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(text)) {
    return false;
  }
  return null;
}

export function excelSerialToDate(serial: number, date1904 = false): Date {
  let normalizedSerial = serial;
  const maxExcelSerial = 2958465;
  while (normalizedSerial > maxExcelSerial && normalizedSerial % 100 === 0) {
    normalizedSerial /= 100;
  }
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(epoch + normalizedSerial * 24 * 60 * 60 * 1000);
}

export function parseDateValue(value: unknown, date1904 = false): Date | null {
  return parseExcelDate(value, date1904);
}

export function parseExcelDate(value: unknown, date1904 = false): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToDate(value, date1904);
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (/^[+-]\d{5,}/.test(text)) {
    return null;
  }
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    return Number.isFinite(serial) ? excelSerialToDate(serial, date1904) : null;
  }
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parts = text.split(/[\/\-]/).map((part) => Number(part));
  if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
    const [a, b, c] = parts;
    let year = c;
    let month = b - 1;
    let day = a;

    if (a > 31) {
      year = a;
      month = b - 1;
      day = c;
    } else if (b > 12 && a <= 12) {
      year = c;
      month = a - 1;
      day = b;
    } else if (c < 100) {
      year = c < 70 ? 2000 + c : 1900 + c;
    }

    const date = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(date.getTime()) || Math.abs(date.getUTCFullYear()) > 9999) {
      return null;
    }
    return date;
  }

  return null;
}

export function toIsoDate(value: unknown): string | null {
  const parsed = parseExcelDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

export function parsePercentageValue(value: unknown): number | null {
  return parseDisplayedPercent(value);
}
