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
export function createPrepareSubmitContract(definition, ..._definitionShapeGate) {
    const definitionSnapshot = Object.freeze({ ...definition });
    const id = definitionSnapshot.id;
    const version = definitionSnapshot.version;
    const subject = definitionSnapshot.subject;
    const prepareCommand = definitionSnapshot.prepareCommand;
    const deriveFunction = definitionSnapshot.derive;
    const derive = (input, context) => deriveFunction.call(definitionSnapshot, input, context);
    const validator = definitionSnapshot.validator;
    if (!id.trim())
        throw new Error('prepare/submit contract id is required');
    if (!Number.isInteger(version) || version < 1) {
        throw new Error('prepare/submit contract version must be a positive integer');
    }
    if (!prepareCommand.trim()) {
        throw new Error('prepare/submit prepareCommand is required');
    }
    const prepareDraft = (draft, context) => {
        const validation = validator(draft, context);
        const checksum = {
            contractId: id,
            contractVersion: version,
            draftDigest: digest(draft),
            validationDigest: digestTransport(validation),
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
        message: message ?? `${subject} refused with ${evaluation.unmetRequirements.length} unmet requirement${evaluation.unmetRequirements.length === 1 ? '' : 's'}.`,
        hint: `Run ${prepareCommand}; resolve every unmetRequirements[].fix; then submit the unchanged green draft.`,
        unmetRequirements: evaluation.unmetRequirements,
        requirementContract: { id, version },
        prepareCommand,
    });
    const contract = {
        id,
        version,
        subject,
        prepareCommand,
        derive,
        validator,
        prepare(input, context) {
            return prepareDraft(derive(input, context), context);
        },
        prepareDraft,
        async submit(prepared, context, commit) {
            const suppliedChecksum = readPreparedChecksum(prepared);
            const checksumMatchesContract = suppliedChecksum !== null
                && suppliedChecksum.contractId === id
                && suppliedChecksum.contractVersion === version;
            const currentDraftDigest = safeDigest(prepared.draft);
            const draftUnchanged = suppliedChecksum !== null
                && currentDraftDigest.ok
                && suppliedChecksum.draftDigest === currentDraftDigest.value;
            const currentValidation = validator(prepared.draft, context);
            const currentValidationDigest = safeTransportDigest(currentValidation);
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
                    refusal: refusal('PREPARE_SUBMIT_DIVERGENCE', currentValidation, `${subject} refused because ${reasons.join('; ')}.`),
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
function digestTransport(value) {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
        throw new TypeError('prepare/submit validation metadata must be JSON-serializable');
    }
    return digest(JSON.parse(serialized));
}
function safeTransportDigest(value) {
    try {
        return { ok: true, value: digestTransport(value) };
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