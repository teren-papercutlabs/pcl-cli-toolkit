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

export type PrepareProof = {
  contractId: string;
  contractVersion: number;
  draftDigest: string;
  validationDigest: string;
};

export type PreparedDraft<Draft> = {
  draft: Draft;
  validation: RequirementEvaluation;
  readyToSubmit: boolean;
  proof: PrepareProof;
};

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
    prepared: PreparedDraft<Draft>,
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
 * serializable prepare proof before committing, so draft or validation drift
 * fails closed instead of reaching the mutation.
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
    return {
      draft,
      validation,
      readyToSubmit: validation.ok,
      proof: {
        contractId: definition.id,
        contractVersion: definition.version,
        draftDigest: digest(draft),
        validationDigest: digest(validation as unknown as JsonValue),
      },
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
      const proofMatchesContract = prepared.proof.contractId === definition.id
        && prepared.proof.contractVersion === definition.version;
      const draftUnchanged = prepared.proof.draftDigest === digest(prepared.draft);
      const currentValidation = validator(prepared.draft, context);
      const validationUnchanged = prepared.proof.validationDigest
        === digest(currentValidation as unknown as JsonValue);

      if (!proofMatchesContract || !draftUnchanged || !validationUnchanged) {
        const reasons = [
          ...(!proofMatchesContract ? ['contract identity/version changed'] : []),
          ...(!draftUnchanged ? ['draft changed after prepare'] : []),
          ...(!validationUnchanged ? ['validator result diverged after prepare'] : []),
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

function digest(value: JsonValue): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
}
