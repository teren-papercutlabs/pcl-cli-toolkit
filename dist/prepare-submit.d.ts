import { type Requirement, type RequirementEvaluation, type RequirementRefusal } from './requirements.js';
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
    readonly [key: string]: JsonValue;
};
export type PrepareSubmitValidator<Draft, Context> = (draft: Readonly<Draft>, context: Readonly<Context>) => RequirementEvaluation;
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
export type PrepareSubmitRefusal = RequirementRefusal & {
    prepareCommand: string;
};
export type SubmitResult<Output> = {
    ok: true;
    output: Output;
} | {
    ok: false;
    refusal: PrepareSubmitRefusal;
};
export type PrepareSubmitDefinition<Input, Draft extends JsonObject, Context> = {
    [key: string]: unknown;
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
    submit: <Output>(prepared: SubmittablePreparedDraft<Draft>, context: Readonly<Context>, commit: (draft: Readonly<Draft>) => Output | Promise<Output>) => Promise<SubmitResult<Output>>;
}>;
/** A visible placeholder for values that require real judgment rather than derivation. */
export declare function judgmentTodo(field: string, instruction?: string): string;
/** Build a validator on the existing all-requirements substrate. */
export declare function createRequirementValidator<Draft, Context>(requirements: (draft: Readonly<Draft>, context: Readonly<Context>) => readonly Requirement[]): PrepareSubmitValidator<Draft, Context>;
/**
 * Create the refusal-proof prepare/submit pair.
 *
 * The definition accepts exactly one validator. Both paths close over that exact
 * function, and the returned contract is frozen. Submit also verifies the
 * serializable checksum before committing, so ordinary draft or validation
 * drift is reported clearly. The checksum is not authentication: submit's
 * authority is always a fresh run of the closed-over validator.
 */
export declare function createPrepareSubmitContract<Input, Draft extends JsonObject, Context>(definition: PrepareSubmitDefinition<Input, Draft, Context>): PrepareSubmitContract<Input, Draft, Context>;
