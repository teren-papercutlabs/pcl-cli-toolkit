import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPrepareSubmitContract,
  createRequirementValidator,
  judgmentTodo,
} from '../dist/index.js';

function exampleContract(validator) {
  return createPrepareSubmitContract({
    id: 'example.create',
    version: 1,
    subject: 'Example create',
    prepareCommand: 'pcl example prepare',
    derive(input, context) {
      return {
        title: input.title ?? judgmentTodo('title', 'supply a useful title'),
        consequence: input.consequence ?? judgmentTodo('consequence'),
        dedupeKey: `${context.sessionId}:${input.parentId}`,
        dispatchClass: 'spawn',
      };
    },
    validator,
  });
}

function requiredDraftValidator() {
  const fields = ['title', 'consequence', 'dedupeKey', 'dispatchClass', 'runtime', 'workerRepo'];
  return createRequirementValidator((draft) => fields.map((field) => ({
    code: `${field.toUpperCase()}_REQUIRED`,
    field,
    message: `${field} is required`,
    fix: `set ${field}`,
    evaluate: () => typeof draft[field] === 'string'
      && draft[field].length > 0
      && !draft[field].startsWith('TODO('),
  })));
}

test('prepare derives deterministic fields, marks judgment TODOs, and aggregates every issue', () => {
  const validator = requiredDraftValidator();
  const contract = exampleContract(validator);
  const prepared = contract.prepare(
    { parentId: 'wb-1' },
    { sessionId: 'session-9' },
  );

  assert.equal(contract.validator, validator);
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(prepared.draft.dedupeKey, 'session-9:wb-1');
  assert.equal(prepared.draft.dispatchClass, 'spawn');
  assert.match(prepared.draft.title, /^TODO\(title\)/);
  assert.deepEqual(
    prepared.validation.unmetRequirements.map((issue) => issue.field),
    ['title', 'consequence', 'runtime', 'workerRepo'],
  );
  assert.equal(prepared.readyToSubmit, false);
});

test('a green prepared draft submits unchanged through the same validator', async () => {
  const validator = requiredDraftValidator();
  const contract = exampleContract(validator);
  const prepared = contract.prepareDraft({
    title: 'Ship it',
    consequence: 'The operation becomes deterministic',
    dedupeKey: 'session-9:wb-1',
    dispatchClass: 'spawn',
    runtime: 'codex',
    workerRepo: 'marshal',
  }, { sessionId: 'session-9' });

  assert.equal(prepared.readyToSubmit, true);
  const submitted = await contract.submit(prepared, { sessionId: 'session-9' }, async (draft) => draft.dedupeKey);
  assert.deepEqual(submitted, { ok: true, output: 'session-9:wb-1' });
});

test('submit refuses all unmet requirements in one envelope and points at prepare', async () => {
  const contract = exampleContract(requiredDraftValidator());
  const prepared = contract.prepareDraft({
    title: '', consequence: '', dedupeKey: '', dispatchClass: '', runtime: '', workerRepo: '',
  }, { sessionId: 'session-9' });
  let committed = false;
  const submitted = await contract.submit(prepared, { sessionId: 'session-9' }, () => { committed = true; });

  assert.equal(submitted.ok, false);
  assert.equal(committed, false);
  assert.equal(submitted.refusal.code, 'REQUIREMENTS_UNMET');
  assert.equal(submitted.refusal.unmetRequirements.length, 6);
  assert.equal(submitted.refusal.prepareCommand, 'pcl example prepare');
  assert.match(submitted.refusal.hint, /pcl example prepare/);
});

test('draft mutation after prepare fails closed before commit', async () => {
  const contract = exampleContract(requiredDraftValidator());
  const prepared = contract.prepareDraft({
    title: 'Ship it', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
  }, { sessionId: 'session-9' });
  prepared.draft.title = 'changed after prepare';

  const submitted = await contract.submit(prepared, { sessionId: 'session-9' }, () => assert.fail('commit must not run'));
  assert.equal(submitted.ok, false);
  assert.equal(submitted.refusal.code, 'PREPARE_SUBMIT_DIVERGENCE');
  assert.match(submitted.refusal.message, /draft changed after prepare/);
});

test('injected validator divergence fails closed and proves prepare/submit identity protection', async () => {
  let calls = 0;
  const validator = () => {
    calls += 1;
    return calls === 1
      ? { ok: true, unmetRequirements: [] }
      : {
          ok: false,
          unmetRequirements: [{
            code: 'INJECTED_DIVERGENCE', field: 'validator', message: 'injected', fix: 'remove divergence',
          }],
        };
  };
  const contract = exampleContract(validator);
  const prepared = contract.prepareDraft({ title: 'x' }, { sessionId: 'session-9' });
  assert.equal(prepared.readyToSubmit, true);

  const submitted = await contract.submit(prepared, { sessionId: 'session-9' }, () => assert.fail('commit must not run'));
  assert.equal(submitted.ok, false);
  assert.equal(submitted.refusal.code, 'PREPARE_SUBMIT_DIVERGENCE');
  assert.match(submitted.refusal.message, /validator result diverged after prepare/);
  assert.equal(contract.validator, validator);
});

test('prepare checksum survives JSON transport between CLI processes', async () => {
  const contract = exampleContract(requiredDraftValidator());
  const prepared = contract.prepareDraft({
    title: 'Ship it', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
  }, { sessionId: 'session-9' });
  const transported = JSON.parse(JSON.stringify(prepared));

  const submitted = await contract.submit(transported, { sessionId: 'session-9' }, (draft) => draft.title);
  assert.deepEqual(submitted, { ok: true, output: 'Ship it' });
});

for (const nonFinite of [Number.NaN, Number.POSITIVE_INFINITY]) {
  test(`a null-to-${String(nonFinite)} change is rejected during checksum comparison`, async () => {
    const contract = createPrepareSubmitContract({
      id: 'numeric.create',
      version: 1,
      subject: 'Numeric create',
      prepareCommand: 'pcl numeric prepare',
      derive: (input) => ({ value: input.value }),
      validator: () => ({ ok: true, unmetRequirements: [] }),
    });
    const prepared = contract.prepare({ value: null }, {});
    prepared.draft.value = nonFinite;

    const submitted = await contract.submit(prepared, {}, () => assert.fail('commit must not run'));
    assert.equal(submitted.ok, false);
    assert.equal(submitted.refusal.code, 'PREPARE_SUBMIT_DIVERGENCE');
    assert.match(submitted.refusal.message, /finite JSON numbers/);
  });
}

test('prepare itself rejects non-finite numbers instead of issuing a colliding checksum', () => {
  const contract = createPrepareSubmitContract({
    id: 'numeric.create',
    version: 1,
    subject: 'Numeric create',
    prepareCommand: 'pcl numeric prepare',
    derive: (input) => ({ value: input.value }),
    validator: () => ({ ok: true, unmetRequirements: [] }),
  });

  assert.throws(
    () => contract.prepare({ value: Number.NEGATIVE_INFINITY }, {}),
    /prepare\/submit checksums require finite JSON numbers/,
  );
});

test('a forged checksum cannot bypass a red validator', async () => {
  const contract = exampleContract(requiredDraftValidator());
  const green = contract.prepareDraft({
    title: 'Ship it', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
  }, { sessionId: 'session-9' });
  const red = contract.prepareDraft({
    title: '', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
  }, { sessionId: 'session-9' });

  // Digests are public checksums. Simulate a caller recomputing both after mutation.
  green.draft.title = '';
  green.checksum.draftDigest = red.checksum.draftDigest;
  green.checksum.validationDigest = red.checksum.validationDigest;
  let committed = false;
  const submitted = await contract.submit(green, { sessionId: 'session-9' }, () => { committed = true; });

  assert.equal(submitted.ok, false);
  assert.equal(submitted.refusal.code, 'REQUIREMENTS_UNMET');
  assert.deepEqual(submitted.refusal.unmetRequirements.map((issue) => issue.field), ['title']);
  assert.equal(committed, false);
});

test('submit accepts the legacy proof-only prepared artifact shape', async () => {
  const contract = exampleContract(requiredDraftValidator());
  const current = contract.prepareDraft({
    title: 'Ship it', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
  }, { sessionId: 'session-9' });
  const legacy = JSON.parse(JSON.stringify(current));
  delete legacy.checksum;

  const submitted = await contract.submit(legacy, { sessionId: 'session-9' }, (draft) => draft.title);
  assert.deepEqual(submitted, { ok: true, output: 'Ship it' });
});

test('a present malformed checksum refuses instead of falling back to intact deprecated proof', async () => {
  const contract = exampleContract(requiredDraftValidator());
  const prepared = contract.prepareDraft({
    title: 'Ship it', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
  }, { sessionId: 'session-9' });
  prepared.checksum = {};
  let committed = false;

  const submitted = await contract.submit(prepared, { sessionId: 'session-9' }, () => { committed = true; });
  assert.equal(submitted.ok, false);
  assert.equal(submitted.refusal.code, 'PREPARE_SUBMIT_DIVERGENCE');
  assert.match(submitted.refusal.message, /missing or malformed/);
  assert.equal(committed, false);
});

test('contract behavior snapshots every definition field and function at creation', async () => {
  const originalValidator = requiredDraftValidator();
  const definition = {
    id: 'snapshot.create',
    version: 1,
    subject: 'Snapshot create',
    prepareCommand: 'pcl snapshot prepare',
    derive: (input) => ({ ...input, source: 'original' }),
    validator: originalValidator,
  };
  const contract = createPrepareSubmitContract(definition);

  definition.id = 'mutated.create';
  definition.version = 99;
  definition.subject = 'Mutated create';
  definition.prepareCommand = 'pcl mutated prepare';
  definition.derive = () => ({ source: 'mutated' });
  definition.validator = () => ({
    ok: false,
    unmetRequirements: [{ code: 'MUTATED', field: 'definition', message: 'mutated', fix: 'restore' }],
  });

  const prepared = contract.prepare({
    title: 'Ship it', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
  }, {});
  assert.equal(contract.id, 'snapshot.create');
  assert.equal(contract.version, 1);
  assert.equal(contract.subject, 'Snapshot create');
  assert.equal(contract.prepareCommand, 'pcl snapshot prepare');
  assert.equal(contract.derive({ value: 'x' }, {}).source, 'original');
  assert.equal(contract.validator, originalValidator);
  assert.equal(prepared.draft.source, 'original');
  assert.equal(prepared.readyToSubmit, true);

  const submitted = await contract.submit(prepared, {}, (draft) => draft.source);
  assert.deepEqual(submitted, { ok: true, output: 'original' });
});

test('undefined validation metadata follows JSON transport semantics', async () => {
  const contract = createPrepareSubmitContract({
    id: 'metadata.create',
    version: 1,
    subject: 'Metadata create',
    prepareCommand: 'pcl metadata prepare',
    derive: (input) => input,
    validator: createRequirementValidator(() => [{
      code: 'VALUE_REQUIRED',
      field: 'value',
      message: 'value is required',
      fix: 'set value',
      evaluate: () => ({ actual: undefined, expected: 'present' }),
    }]),
  });

  const prepared = contract.prepare({ value: null }, {});
  assert.equal(prepared.readyToSubmit, false);
  assert.equal(Object.hasOwn(prepared.validation.unmetRequirements[0], 'actual'), true);
  const transported = JSON.parse(JSON.stringify(prepared));
  assert.equal(Object.hasOwn(transported.validation.unmetRequirements[0], 'actual'), false);

  const submitted = await contract.submit(transported, {}, () => assert.fail('commit must not run'));
  assert.equal(submitted.ok, false);
  assert.equal(submitted.refusal.code, 'REQUIREMENTS_UNMET');
  assert.deepEqual(submitted.refusal.unmetRequirements.map((issue) => issue.field), ['value']);
});

for (const malformed of [undefined, null, 'not-a-checksum', {}, { contractId: 'example.create' }]) {
  test(`missing or malformed checksum metadata refuses structurally: ${JSON.stringify(malformed)}`, async () => {
    const contract = exampleContract(requiredDraftValidator());
    const prepared = contract.prepareDraft({
      title: 'Ship it', consequence: 'Safe', dedupeKey: 'a', dispatchClass: 'spawn', runtime: 'codex', workerRepo: 'marshal',
    }, { sessionId: 'session-9' });
    prepared.checksum = malformed;
    prepared.proof = malformed;
    let committed = false;

    const submitted = await contract.submit(prepared, { sessionId: 'session-9' }, () => { committed = true; });
    assert.equal(submitted.ok, false);
    assert.equal(submitted.refusal.code, 'PREPARE_SUBMIT_DIVERGENCE');
    assert.match(submitted.refusal.message, /missing or malformed/);
    assert.equal(committed, false);
  });
}
