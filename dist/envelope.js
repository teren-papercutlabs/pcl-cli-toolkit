import { randomUUID } from 'crypto';
const requestId = randomUUID();
const startTime = Date.now();
function buildCommand() {
    const args = process.argv.slice(2);
    const name = process.argv[1]?.split('/').pop()?.replace(/\.\w+$/, '') ?? 'cli';
    return args.length > 0 ? `${name} ${args.join(' ')}` : name;
}
export function buildMeta(overrides) {
    return {
        command: overrides?.command ?? buildCommand(),
        requestId: overrides?.requestId ?? requestId,
        durationMs: overrides?.durationMs ?? Math.max(0, Date.now() - startTime),
    };
}
export function writeJson(payload, pretty) {
    const json = JSON.stringify(payload, null, pretty ? 2 : undefined);
    process.stdout.write(`${json}\n`);
}
export function writeEnvelope(data, options) {
    writeJson({ ok: true, data, meta: buildMeta(options?.meta) }, options?.pretty);
}
export function writeErrorEnvelope(error, options) {
    const { code, message, hint, ...extra } = error;
    writeJson({
        ok: false,
        error: { code: code ?? 'ERROR', message, ...(hint ? { hint } : {}), ...extra },
        meta: buildMeta(options?.meta),
    }, options?.pretty);
    if (!process.exitCode || process.exitCode === 0) {
        process.exitCode = 1;
    }
}
//# sourceMappingURL=envelope.js.map