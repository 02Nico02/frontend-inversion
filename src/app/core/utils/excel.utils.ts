export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function columnIndexToName(index: number): string {
  let n = index;
  let name = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function columnNameToIndex(name: string): number {
  let index = 0;
  for (const char of name.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
}

export function parseTableRef(ref: string): { startCol: number; startRow: number; endCol: number; endRow: number } {
  const [start, end] = ref.split(':');
  const startMatch = /^([A-Z]+)(\d+)$/.exec(start);
  const endMatch = /^([A-Z]+)(\d+)$/.exec(end);
  if (!startMatch || !endMatch) {
    throw new Error(`Invalid table ref: ${ref}`);
  }
  return {
    startCol: columnNameToIndex(startMatch[1]),
    startRow: Number(startMatch[2]),
    endCol: columnNameToIndex(endMatch[1]),
    endRow: Number(endMatch[2])
  };
}

export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
