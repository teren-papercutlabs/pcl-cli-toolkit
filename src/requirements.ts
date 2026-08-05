export type UnmetRequirement = {
  code: string;
  field: string;
  message: string;
  fix: string;
  expected?: unknown;
  actual?: unknown;
};

export type RequirementResult =
  | boolean
  | Omit<UnmetRequirement, 'code' | 'field' | 'message' | 'fix'>;

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
export function evaluateRequirements(
  requirements: readonly Requirement[],
): RequirementEvaluation {
  const unmetRequirements: UnmetRequirement[] = [];
  for (const requirement of requirements) {
    const result = requirement.evaluate();
    if (result === true) continue;
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
export function buildRequirementRefusal(input: {
  code: string;
  subject: string;
  evaluation: RequirementEvaluation;
  requirementContract?: unknown;
}): RequirementRefusal | null {
  if (input.evaluation.ok) return null;
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
