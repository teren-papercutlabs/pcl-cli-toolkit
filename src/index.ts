// Core
export { bootstrap, runCli } from './bootstrap.js';
export { loadEnv } from './env.js';
export { writeEnvelope, writeErrorEnvelope, writeJson, buildMeta, setSensitiveFlags } from './envelope.js';
export type { CliMeta, CliError } from './envelope.js';
export { unwrap } from './result.js';
export type { CliResult, CliSuccess, CliFailure } from './result.js';

// Introspection
export { describe, registerDescribe } from './describe.js';
export type { CliManifest } from './describe.js';

// Validation
export { parseDate, parseNumber, parseEnum, requireHumanApproval } from './validate.js';

// Input
export { readInput } from './input.js';
