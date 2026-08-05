# Prepare/submit contracts

Use `createPrepareSubmitContract` when a CLI noun has a draft-producing `prepare` command and a state-changing `submit` command.

The definition supplies derivation and exactly one validator. The contract closes both paths over that validator, aggregates requirements through `createRequirementValidator`, and emits a serializable proof binding the contract version, draft, and validation result. Submit revalidates and fails closed on changed drafts, changed contract versions, or validator divergence before the mutation callback runs.

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

const prepared = create.prepare(input, context); // emit draft + validation + proof
const result = await create.submit(prepared, context, persist); // persist runs only when green and unchanged
```

Adoption rules:

1. Derive machine-known fields; mark genuine judgment with `judgmentTodo`.
2. Declare every requirement together. Never short-circuit or duplicate validation in the command.
3. Emit the complete `PreparedDraft` so its proof survives a separate CLI process.
4. Submit only through `contract.submit`; surface its refusal unchanged. The hint points back to prepare.
5. Increment `version` when derivation or validation semantics change.
