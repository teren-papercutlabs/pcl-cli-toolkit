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

function buildCommand(): string {
  const args = process.argv.slice(2);
  const name = process.argv[1]?.split('/').pop()?.replace(/\.\w+$/, '') ?? 'cli';
  return args.length > 0 ? `${name} ${args.join(' ')}` : name;
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
    process.exitCode = 1;
  }
}
