import { createHash } from 'node:crypto';
import { evaluateRequirements, } from './requirements.js';
/** A visible placeholder for values that require real judgment rather than derivation. */
export function judgmentTodo(field, instruction) {
    return `TODO(${field})${instruction ? `: ${instruction}` : ''}`;
}
/** Build a validator on the existing all-requirements substrate. */
export function createRequirementValidator(requirements) {
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
export function createPrepareSubmitContract(definition) {
    if (!definition.id.trim())
        throw new Error('prepare/submit contract id is required');
    if (!Number.isInteger(definition.version) || definition.version < 1) {
        throw new Error('prepare/submit contract version must be a positive integer');
    }
    if (!definition.prepareCommand.trim()) {
        throw new Error('prepare/submit prepareCommand is required');
    }
    const validator = definition.validator;
    const prepareDraft = (draft, context) => {
        const validation = validator(draft, context);
        const checksum = {
            contractId: definition.id,
            contractVersion: definition.version,
            draftDigest: digest(draft),
            validationDigest: digest(validation),
        };
        return {
            draft,
            validation,
            readyToSubmit: validation.ok,
            checksum,
            proof: checksum,
        };
    };
    const refusal = (code, evaluation, message) => ({
        code,
        message: message ?? `${definition.subject} refused with ${evaluation.unmetRequirements.length} unmet requirement${evaluation.unmetRequirements.length === 1 ? '' : 's'}.`,
        hint: `Run ${definition.prepareCommand}; resolve every unmetRequirements[].fix; then submit the unchanged green draft.`,
        unmetRequirements: evaluation.unmetRequirements,
        requirementContract: { id: definition.id, version: definition.version },
        prepareCommand: definition.prepareCommand,
    });
    const contract = {
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
            const currentValidationDigest = safeDigest(currentValidation);
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
                    refusal: refusal('PREPARE_SUBMIT_DIVERGENCE', currentValidation, `${definition.subject} refused because ${reasons.join('; ')}.`),
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
function readPreparedChecksum(prepared) {
    if (Object.prototype.hasOwnProperty.call(prepared, 'checksum')) {
        return isPrepareChecksum(prepared.checksum) ? prepared.checksum : null;
    }
    if (isPrepareChecksum(prepared.proof))
        return prepared.proof;
    return null;
}
function isPrepareChecksum(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return typeof candidate.contractId === 'string'
        && Number.isInteger(candidate.contractVersion)
        && typeof candidate.draftDigest === 'string'
        && typeof candidate.validationDigest === 'string';
}
function digest(value) {
    return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
function safeDigest(value) {
    try {
        return { ok: true, value: digest(value) };
    }
    catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}
function canonicalJson(value) {
    if (value === null)
        return 'null';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError('prepare/submit checksums require finite JSON numbers');
        }
        return JSON.stringify(value);
    }
    if (typeof value === 'string' || typeof value === 'boolean')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
}
//# sourceMappingURL=prepare-submit.js.map