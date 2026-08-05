// Core
export { bootstrap, runCli, addAgentAliases } from './bootstrap.js';
export { loadEnv } from './env.js';
export { writeEnvelope, writeErrorEnvelope, writeJson, writeCreateResult, buildMeta, setSensitiveFlags } from './envelope.js';
export type { CliMeta, CliError } from './envelope.js';
export { addVerboseFlag, isVerbose } from './verbose-flag.js';
export { unwrap } from './result.js';
export type { CliResult, CliSuccess, CliFailure } from './result.js';

// Introspection
export { describe, registerDescribe } from './describe.js';
export type { CliManifest } from './describe.js';

// Validation
export { parseDate, parseNumber, parseEnum, requireHumanApproval } from './validate.js';

// Requirement evaluation
export { evaluateRequirements, buildRequirementRefusal } from './requirements.js';
export type {
  Requirement,
  RequirementEvaluation,
  RequirementRefusal,
  RequirementResult,
  UnmetRequirement,
} from './requirements.js';

// Input
export { readInput } from './input.js';

// Refusal-proof prepare/submit contracts
export { createPrepareSubmitContract, createRequirementValidator, judgmentTodo } from './prepare-submit.js';
export type {
  JsonObject,
  JsonPrimitive,
  JsonValue,
  PreparedDraft,
  PrepareChecksum,
  PrepareProof,
  PrepareSubmitContract,
  PrepareSubmitDefinition,
  PrepareSubmitRefusal,
  PrepareSubmitValidator,
  SubmitResult,
} from './prepare-submit.js';
