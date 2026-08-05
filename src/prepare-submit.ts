import { createHash } from 'node:crypto';
import {
  evaluateRequirements,
  type Requirement,
  type RequirementEvaluation,
  type RequirementRefusal,
} from './requirements.js';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type PrepareSubmitValidator<Draft, Context> = (
  draft: Readonly<Draft>,
  context: Readonly<Context>,
) => RequirementEvaluation;

/** Accidental-change checksum. This is not an authentication or tamper-proof token. */
export type PrepareChecksum = {
  contractId: string;
  contractVersion: number;
  draftDigest: string;
  validationDigest: string;
};

/** @deprecated Use PrepareChecksum. Retained for prepared-artifact wire compatibility. */
export type PrepareProof = PrepareChecksum;

export type PreparedDraft<Draft> = {
  draft: Draft;
  validation: RequirementEvaluation;
  readyToSubmit: boolean;
  checksum: PrepareChecksum;
  /** @deprecated Use checksum. Submit continues to accept legacy prepared artifacts. */
  proof?: PrepareProof;
};

/** Legacy proof-only wire shape accepted by submit, but never emitted by prepare. */
export type LegacyPreparedDraft<Draft> = {
  draft: Draft;
  validation: RequirementEvaluation;
  readyToSubmit: boolean;
  proof: PrepareProof;
  checksum?: never;
};

export type SubmittablePreparedDraft<Draft> = PreparedDraft<Draft> | LegacyPreparedDraft<Draft>;

type Assert<T extends true> = T;
type IsRequired<T, Key extends keyof T> = {} extends Pick<T, Key> ? false : true;
/** Compile-time regression guard: current callers may rely on checksum being required. */
type PreparedDraftChecksumMustRemainRequired = Assert<
  IsRequired<PreparedDraft<JsonObject>, 'checksum'>
>;

export type PrepareSubmitRefusal = RequirementRefusal & {
  prepareCommand: string;
};

export type SubmitResult<Output> =
  | { ok: true; output: Output }
  | { ok: false; refusal: PrepareSubmitRefusal };

export type PrepareSubmitDefinition<Input, Draft extends JsonObject, Context> = {
  id: string;
  version: number;
  subject: string;
  prepareCommand: string;
  derive: (input: Readonly<Input>, context: Readonly<Context>) => Draft;
  validator: PrepareSubmitValidator<Draft, Context>;
};

export type PrepareSubmitContract<Input, Draft extends JsonObject, Context> = Readonly<{
  id: string;
  version: number;
  subject: string;
  prepareCommand: string;
  derive: PrepareSubmitDefinition<Input, Draft, Context>['derive'];
  /** The single validator used by both prepare and submit. Exposed for identity checks. */
  validator: PrepareSubmitValidator<Draft, Context>;
  prepare: (input: Readonly<Input>, context: Readonly<Context>) => PreparedDraft<Draft>;
  prepareDraft: (draft: Draft, context: Readonly<Context>) => PreparedDraft<Draft>;
  submit: <Output>(
    prepared: SubmittablePreparedDraft<Draft>,
    context: Readonly<Context>,
    commit: (draft: Readonly<Draft>) => Output | Promise<Output>,
  ) => Promise<SubmitResult<Output>>;
}>;

/** A visible placeholder for values that require real judgment rather than derivation. */
export function judgmentTodo(field: string, instruction?: string): string {
  return `TODO(${field})${instruction ? `: ${instruction}` : ''}`;
}

/** Build a validator on the existing all-requirements substrate. */
export function createRequirementValidator<Draft, Context>(
  requirements: (draft: Readonly<Draft>, context: Readonly<Context>) => readonly Requirement[],
): PrepareSubmitValidator<Draft, Context> {
  return (draft, context) => evaluateRequirements(requirements(draft, context));
}

/**
 * Create the refusal-proof prepare/submit pair.
 *
 * The definition accepts exactly one validator. Both paths close over that exact
 * function, and the returned contract is frozen. Submit also verifies the
 * serializable checksum before committing, so ordinary draft or validation
 * drift is reported clearly. The checksum is not authentication: submit's
 * authority is always a fresh run of the closed-over validator.
 */
export function createPrepareSubmitContract<Input, Draft extends JsonObject, Context>(
  definition: PrepareSubmitDefinition<Input, Draft, Context>,
): PrepareSubmitContract<Input, Draft, Context> {
  if (!definition.id.trim()) throw new Error('prepare/submit contract id is required');
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new Error('prepare/submit contract version must be a positive integer');
  }
  if (!definition.prepareCommand.trim()) {
    throw new Error('prepare/submit prepareCommand is required');
  }

  const validator = definition.validator;

  const prepareDraft = (draft: Draft, context: Readonly<Context>): PreparedDraft<Draft> => {
    const validation = validator(draft, context);
    const checksum: PrepareChecksum = {
      contractId: definition.id,
      contractVersion: definition.version,
      draftDigest: digest(draft),
      validationDigest: digest(validation as unknown as JsonValue),
    };
    return {
      draft,
      validation,
      readyToSubmit: validation.ok,
      checksum,
      proof: checksum,
    };
  };

  const refusal = (
    code: string,
    evaluation: RequirementEvaluation,
    message?: string,
  ): PrepareSubmitRefusal => ({
    code,
    message: message ?? `${definition.subject} refused with ${evaluation.unmetRequirements.length} unmet requirement${evaluation.unmetRequirements.length === 1 ? '' : 's'}.`,
    hint: `Run ${definition.prepareCommand}; resolve every unmetRequirements[].fix; then submit the unchanged green draft.`,
    unmetRequirements: evaluation.unmetRequirements,
    requirementContract: { id: definition.id, version: definition.version },
    prepareCommand: definition.prepareCommand,
  });

  const contract: PrepareSubmitContract<Input, Draft, Context> = {
    id: definition.id,
    version: definition.version,
    subject: definition.subject,
    prepareCommand: definition.prepareCommand,
    derive: definition.derive,
    validator,
    prepare(input, context) {
      return prepareDraft(definition.derive(input, context), context);
    },
    prepareDraft,
    async submit(prepared, context, commit) {
      const suppliedChecksum = readPreparedChecksum(prepared);
      const checksumMatchesContract = suppliedChecksum !== null
        && suppliedChecksum.contractId === definition.id
        && suppliedChecksum.contractVersion === definition.version;
      const currentDraftDigest = safeDigest(prepared.draft);
      const draftUnchanged = suppliedChecksum !== null
        && currentDraftDigest.ok
        && suppliedChecksum.draftDigest === currentDraftDigest.value;
      const currentValidation = validator(prepared.draft, context);
      const currentValidationDigest = safeDigest(currentValidation as unknown as JsonValue);
      const validationUnchanged = suppliedChecksum !== null
        && currentValidationDigest.ok
        && suppliedChecksum.validationDigest === currentValidationDigest.value;

      if (!checksumMatchesContract || !draftUnchanged || !validationUnchanged) {
        const reasons = [
          ...(suppliedChecksum === null ? ['prepared checksum/proof is missing or malformed'] : []),
          ...(!checksumMatchesContract ? ['contract identity/version changed'] : []),
          ...(!draftUnchanged
            ? [currentDraftDigest.ok
              ? 'draft changed after prepare'
              : `draft cannot be proven: ${currentDraftDigest.error.message}`]
            : []),
          ...(!validationUnchanged
            ? [currentValidationDigest.ok
              ? 'validator result diverged after prepare'
              : `validator result cannot be proven: ${currentValidationDigest.error.message}`]
            : []),
        ];
        return {
          ok: false,
          refusal: refusal(
            'PREPARE_SUBMIT_DIVERGENCE',
            currentValidation,
            `${definition.subject} refused because ${reasons.join('; ')}.`,
          ),
        };
      }

      if (!currentValidation.ok) {
        return { ok: false, refusal: refusal('REQUIREMENTS_UNMET', currentValidation) };
      }
      return { ok: true, output: await commit(prepared.draft) };
    },
  };

  return Object.freeze(contract);
}

function readPreparedChecksum<Draft>(prepared: SubmittablePreparedDraft<Draft>): PrepareChecksum | null {
  if (isPrepareChecksum(prepared.checksum)) return prepared.checksum;
  if (isPrepareChecksum(prepared.proof)) return prepared.proof;
  return null;
}

function isPrepareChecksum(value: unknown): value is PrepareChecksum {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PrepareChecksum>;
  return typeof candidate.contractId === 'string'
    && Number.isInteger(candidate.contractVersion)
    && typeof candidate.draftDigest === 'string'
    && typeof candidate.validationDigest === 'string';
}

function digest(value: JsonValue): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function safeDigest(value: JsonValue):
  | { ok: true; value: string }
  | { ok: false; error: Error } {
  try {
    return { ok: true, value: digest(value) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function canonicalJson(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('prepare/submit checksums require finite JSON numbers');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
}
