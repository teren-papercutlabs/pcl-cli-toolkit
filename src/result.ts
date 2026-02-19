import { writeErrorEnvelope } from './envelope.js';

export type CliSuccess<T> = { ok: true; data: T };
export type CliFailure = { ok: false; error: { code: string; message: string; [key: string]: unknown } };
export type CliResult<T> = CliSuccess<T> | CliFailure;

/**
 * Extracts data from a CliResult, or writes error envelope and exits.
 * Handles both the richer { ok: false, error: { code, message } } shape
 * and the simpler { ok: false, error: "string" } shape from older CLIs.
 */
export function unwrap<T>(result: CliResult<T> | { ok: false; error: string }): T {
  if (result.ok) return (result as CliSuccess<T>).data;

  const err = result.error;
  if (typeof err === 'string') {
    writeErrorEnvelope({ message: err });
  } else {
    writeErrorEnvelope(err);
  }
  process.exit(1);
}
