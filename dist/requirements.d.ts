export type UnmetRequirement = {
    code: string;
    field: string;
    message: string;
    fix: string;
    expected?: unknown;
    actual?: unknown;
    evaluationError?: {
        name: string;
        message: string;
    };
};
export type RequirementResult = boolean | Omit<UnmetRequirement, 'code' | 'field' | 'message' | 'fix'>;
export type Requirement = {
    code: string;
    field: string;
    message: string;
    fix: string;
    expected?: unknown;
    actual?: unknown;
    evaluate: () => RequirementResult;
};
export type RequirementEvaluation = {
    ok: boolean;
    unmetRequirements: UnmetRequirement[];
};
export type RequirementRefusal = {
    code: string;
    message: string;
    hint: string;
    unmetRequirements: UnmetRequirement[];
    requirementContract?: unknown;
};
/** Evaluate every declared requirement. A failed requirement never short-circuits siblings. */
export declare function evaluateRequirements(requirements: readonly Requirement[]): RequirementEvaluation;
/** Build the one-envelope refusal contract consumed by PcL CLIs. */
export declare function buildRequirementRefusal(input: {
    code: string;
    subject: string;
    evaluation: RequirementEvaluation;
    requirementContract?: unknown;
}): RequirementRefusal | null;
