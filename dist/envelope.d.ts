export type CliMeta = {
    command: string;
    requestId: string;
    durationMs: number;
};
export type CliError = {
    code: string;
    message: string;
    hint?: string;
    [key: string]: unknown;
};
/** Register flag names whose values should be redacted from meta.command */
export declare function setSensitiveFlags(flags: string[]): void;
export declare function buildMeta(overrides?: Partial<CliMeta>): CliMeta;
export declare function writeJson(payload: unknown, pretty?: boolean): void;
export declare function writeEnvelope<T>(data: T, options?: {
    pretty?: boolean;
    meta?: Partial<CliMeta>;
}): void;
export declare function writeErrorEnvelope(error: {
    message: string;
    code?: string;
    hint?: string;
    [key: string]: unknown;
}, options?: {
    pretty?: boolean;
    meta?: Partial<CliMeta>;
}): void;
