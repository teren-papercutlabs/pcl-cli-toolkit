import { writeErrorEnvelope } from './envelope.js';
/**
 * Parse a string as a date. Writes error envelope and exits on invalid input.
 */
export function parseDate(value, label) {
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
export function parseNumber(value, label) {
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
export function parseEnum(value, validValues, label) {
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
//# sourceMappingURL=validate.js.map