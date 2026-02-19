import { randomUUID } from 'crypto';
const requestId = randomUUID();
const startTime = Date.now();
let sensitiveFlags = [];
/** Register flag names whose values should be redacted from meta.command */
export function setSensitiveFlags(flags) {
    sensitiveFlags = flags;
}
function buildCommand() {
    const args = process.argv.slice(2);
    const name = process.argv[1]?.split('/').pop()?.replace(/\.\w+$/, '') ?? 'cli';
    if (args.length === 0)
        return name;
    const redacted = [];
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