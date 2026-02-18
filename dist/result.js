import { writeErrorEnvelope } from './envelope.js';
/**
 * Extracts data from a CliResult, or writes error envelope and exits.
 * Handles both the richer { ok: false, error: { code, message } } shape
 * and the simpler { ok: false, error: "string" } shape from older CLIs.
 */
export function unwrap(result) {
    if (result.ok)
        return result.data;
    const err = result.error;
    if (typeof err === 'string') {
        writeErrorEnvelope({ message: err });
    }
    else {
        writeErrorEnvelope({ code: err.code, message: err.message });
    }
    process.exit(1);
}
//# sourceMappingURL=result.js.map