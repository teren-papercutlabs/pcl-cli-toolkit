import { randomUUID } from 'crypto';

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

const requestId = randomUUID();
const startTime = Date.now();

let sensitiveFlags: string[] = [];

/** Register flag names whose values should be redacted from meta.command */
export function setSensitiveFlags(flags: string[]): void {
  sensitiveFlags = flags;
}

function buildCommand(): string {
  const args = process.argv.slice(2);
  const name = process.argv[1]?.split('/').pop()?.replace(/\.\w+$/, '') ?? 'cli';
  if (args.length === 0) return name;

  const redacted: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    // Check if this arg is a sensitive flag with = syntax (--flag=value)
    const eqMatch = sensitiveFlags.find(f => arg.startsWith(f + '='));
    if (eqMatch) {
      redacted.push(`${eqMatch}=***`);
      continue;
    }
    // Check if this arg is a sensitive flag followed by its value
    if (sensitiveFlags.includes(arg) && i + 1 < args.length) {
      redacted.push(arg, '***');
      i++; // skip the value
      continue;
    }
    redacted.push(arg);
  }
  return `${name} ${redacted.join(' ')}`;
}

export function buildMeta(overrides?: Partial<CliMeta>): CliMeta {
  return {
    command: overrides?.command ?? buildCommand(),
    requestId: overrides?.requestId ?? requestId,
    durationMs: overrides?.durationMs ?? Math.max(0, Date.now() - startTime),
  };
}

export function writeJson(payload: unknown, pretty?: boolean): void {
  const json = JSON.stringify(payload, null, pretty ? 2 : undefined);
  process.stdout.write(`${json}\n`);
}

export function writeEnvelope<T>(
  data: T,
  options?: { pretty?: boolean; meta?: Partial<CliMeta> },
): void {
  writeJson({ ok: true, data, meta: buildMeta(options?.meta) }, options?.pretty);
}

function exitCodeForError(code: string): number {
  // Not found — resource doesn't exist
  if (code.endsWith('_NOT_FOUND') || code.startsWith('MISSING_')) return 2;
  // Already exists — idempotent create, treat as soft error
  if (code.endsWith('_EXISTS') || code.startsWith('ALREADY_')) return 3;
  // Invalid input — validation error, bad flags, wrong format
  if (code.startsWith('INVALID_') || code === 'PREFIX_TOO_SHORT' || code === 'UNKNOWN_OPTION') return 4;
  // Operation failed — runtime error, query failure, spawn error
  if (code.endsWith('_FAILED') || code === 'TIMEOUT' || code === 'DB_ERROR' || code === 'SPAWN_ERROR') return 5;
  // Default — generic error
  return 1;
}

export function writeErrorEnvelope(
  error: { message: string; code?: string; hint?: string; [key: string]: unknown },
  options?: { pretty?: boolean; meta?: Partial<CliMeta> },
): void {
  const { code, message, hint, ...extra } = error;
  writeJson(
    {
      ok: false,
      error: { code: code ?? 'ERROR', message, ...(hint ? { hint } : {}), ...extra },
      meta: buildMeta(options?.meta),
    },
    options?.pretty,
  );
  if (!process.exitCode || process.exitCode === 0) {
    process.exitCode = exitCodeForError(code ?? 'ERROR');
  }
}
