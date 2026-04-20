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
/**
 * Write the result of a `pcl * create` / `register` command.
 *
 * Default output is ID-only (one ID per line, `\n`-terminated). Pass
 * `{ verbose: true }` to emit the full envelope instead. Callers are expected
 * to merge `--verbose` and `--json` flag values into the `verbose` option —
 * see `addVerboseFlag()`.
 *
 * Rationale: create commands return a single new-entity identifier that the
 * caller almost always wants to assign directly — `ID=$(pcl foo create ...)`.
 * Envelope output required `jq -r '.data.id'` which was the source of
 * repeated parse-fragility bugs in agent-generated callsites.
 */
export declare function writeCreateResult(id: string | string[], fullData: unknown, options?: {
    verbose?: boolean;
    pretty?: boolean;
    meta?: Partial<CliMeta>;
}): void;
