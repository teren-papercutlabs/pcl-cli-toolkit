/**
 * Parse a string as a date. Writes error envelope and exits on invalid input.
 */
export declare function parseDate(value: string, label?: string): Date;
/**
 * Parse a string as a number. Writes error envelope and exits on invalid input.
 */
export declare function parseNumber(value: string, label?: string): number;
/**
 * Parse a string as an enum value. Writes error envelope and exits if not in valid set.
 */
export declare function parseEnum<T extends string>(value: string, validValues: readonly T[], label?: string): T;
