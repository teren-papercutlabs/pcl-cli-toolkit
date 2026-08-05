# Prepare/submit contracts

Use `createPrepareSubmitContract` when a CLI noun has a draft-producing `prepare` command and a state-changing `submit` command.

The definition supplies derivation and exactly one validator. The contract closes both paths over that validator, aggregates requirements through `createRequirementValidator`, and emits a serializable checksum for the contract version, draft, and validation result. The checksum catches accidental changes and stale wrappers; it is public data, not authentication or a tamper-proof token. Submit always reruns the closed-over validator and only invokes the mutation callback when that current result is green.

Prepared output also carries the same checksum under deprecated `proof` for wire compatibility. `PreparedDraft.checksum` remains required for current TypeScript callers; only `contract.submit` widens its input to `SubmittablePreparedDraft`, which also accepts the exported legacy proof-only shape. Missing or malformed metadata returns a structured `PREPARE_SUBMIT_DIVERGENCE`; it never bypasses validation or reaches persistence.

Definitions may carry noun-specific enumerable fields. A method-style `derive` reads them through `this`; the toolkit shallow-snapshots and freezes that full definition at contract creation. These extra fields are deliberately dynamically typed so direct object-literal authoring such as `prefix: string` plus `this.prefix` compiles without a second schema type.

```ts
const create = createPrepareSubmitContract({
  id: 'wb.create',
  version: 1,
  subject: 'Whiteboard create',
  prepareCommand: 'pcl wb prepare',
  derive: (input, context) => ({
    dedupeKey: `${context.sessionId}:${context.parentWb}`,
    title: input.title ?? judgmentTodo('title'),
  }),
  validator: createRequirementValidator((draft) => requirementsFor(draft)),
});

const prepared = create.prepare(input, context); // emit draft + validation + checksum
const result = await create.submit(prepared, context, persist); // persist runs only when green and unchanged
```

Adoption rules:

1. Derive machine-known fields; mark genuine judgment with `judgmentTodo`.
2. Declare every requirement together. Never short-circuit or duplicate validation in the command.
3. Emit the complete `PreparedDraft` so its accidental-change checksum survives a separate CLI process. Never treat it as authentication.
4. Submit only through `contract.submit`; surface its refusal unchanged. The hint points back to prepare.
5. Increment `version` when derivation or validation semantics change.
