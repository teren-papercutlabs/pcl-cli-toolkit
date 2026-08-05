/** Evaluate every declared requirement. A failed requirement never short-circuits siblings. */
export function evaluateRequirements(requirements) {
    const unmetRequirements = [];
    for (const requirement of requirements) {
        const result = requirement.evaluate();
        if (result === true)
            continue;
        const details = result === false ? {} : result;
        unmetRequirements.push({
            code: requirement.code,
            field: requirement.field,
            message: requirement.message,
            fix: requirement.fix,
            ...(requirement.expected === undefined ? {} : { expected: requirement.expected }),
            ...(requirement.actual === undefined ? {} : { actual: requirement.actual }),
            ...details,
        });
    }
    return { ok: unmetRequirements.length === 0, unmetRequirements };
}
/** Build the one-envelope refusal contract consumed by PcL CLIs. */
export function buildRequirementRefusal(input) {
    if (input.evaluation.ok)
        return null;
    const count = input.evaluation.unmetRequirements.length;
    return {
        code: input.code,
        message: `${input.subject} refused with ${count} unmet requirement${count === 1 ? '' : 's'}.`,
        hint: 'Apply every unmetRequirements[].fix command, then retry the original command once.',
        unmetRequirements: input.evaluation.unmetRequirements,
        ...(input.requirementContract === undefined
            ? {}
            : { requirementContract: input.requirementContract }),
    };
}
//# sourceMappingURL=requirements.js.map