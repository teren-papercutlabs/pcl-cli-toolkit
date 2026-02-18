import { writeErrorEnvelope } from './envelope.js';

/**
 * Parse a string as a date. Writes error envelope and exits on invalid input.
 */
export function parseDate(value: string, label?: string): Date {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    writeErrorEnvelope({
      code: 'INVALID_DATE',
      message: `Invalid date${label ? ` for ${label}` : ''}: "${value}"`,
    });
    process.exit(1);
  }
  return d;
}

/**
 * Parse a string as a number. Writes error envelope and exits on invalid input.
 */
export function parseNumber(value: string, label?: string): number {
  const n = parseFloat(value);
  if (isNaN(n)) {
    writeErrorEnvelope({
      code: 'INVALID_NUMBER',
      message: `Invalid number${label ? ` for ${label}` : ''}: "${value}"`,
    });
    process.exit(1);
  }
  return n;
}

/**
 * Parse a string as an enum value. Writes error envelope and exits if not in valid set.
 */
export function parseEnum<T extends string>(value: string, validValues: readonly T[], label?: string): T {
  const lower = value.toLowerCase();
  const match = validValues.find(v => v.toLowerCase() === lower);
  if (!match) {
    writeErrorEnvelope({
      code: 'INVALID_ENUM',
      message: `Invalid value${label ? ` for ${label}` : ''}: "${value}". Valid: ${validValues.join(', ')}`,
    });
    process.exit(1);
  }
  return match;
}
