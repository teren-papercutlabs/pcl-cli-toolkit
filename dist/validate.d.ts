/**
 * Guard for commands that require explicit human approval.
 * Agent must pass --human-approved to confirm a human sanctioned this action.
 * Writes error envelope and exits if flag is missing.
 */
export declare function requireHumanApproval(opts: {
    humanApproved?: boolean;
}, commandName?: string): void;
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
