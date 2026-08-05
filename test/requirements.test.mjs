import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRequirementRefusal,
  evaluateRequirements,
} from '../dist/index.js';

test('evaluates every requirement and preserves declaration order', () => {
  const visited = [];
  const result = evaluateRequirements([
    {
      code: 'FIRST_REQUIRED',
      field: 'first',
      message: 'first is required',
      fix: 'pcl example --first value',
      evaluate: () => {
        visited.push('first');
        return false;
      },
    },
    {
      code: 'SECOND_REQUIRED',
      field: 'second',
      message: 'second is required',
      fix: 'pcl example --second value',
      evaluate: () => {
        visited.push('second');
        return true;
      },
    },
    {
      code: 'THIRD_REQUIRED',
      field: 'third',
      message: 'third is required',
      fix: 'pcl example --third value',
      evaluate: () => {
        visited.push('third');
        return { actual: null, expected: 'value' };
      },
    },
  ]);

  assert.deepEqual(visited, ['first', 'second', 'third']);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.unmetRequirements.map((item) => item.code),
    ['FIRST_REQUIRED', 'THIRD_REQUIRED'],
  );
  assert.equal(result.unmetRequirements[1].fix, 'pcl example --third value');
  assert.equal(result.unmetRequirements[1].actual, null);
});

test('builds one refusal envelope payload with every copyable fix', () => {
  const evaluation = evaluateRequirements([
    {
      code: 'A_REQUIRED',
      field: 'a',
      message: 'a is required',
      fix: 'pcl example --a value',
      evaluate: () => false,
    },
    {
      code: 'B_REQUIRED',
      field: 'b',
      message: 'b is required',
      fix: 'pcl example --b value',
      evaluate: () => false,
    },
  ]);
  const refusal = buildRequirementRefusal({
    code: 'REQUIREMENTS_UNMET',
    subject: 'Example command',
    evaluation,
    requirementContract: { version: 1 },
  });

  assert.deepEqual(refusal, {
    code: 'REQUIREMENTS_UNMET',
    message: 'Example command refused with 2 unmet requirements.',
    hint: 'Apply every unmetRequirements[].fix command, then retry the original command once.',
    unmetRequirements: evaluation.unmetRequirements,
    requirementContract: { version: 1 },
  });
});

test('returns null when every requirement passes', () => {
  const evaluation = evaluateRequirements([{
    code: 'READY',
    field: 'ready',
    message: 'ready is required',
    fix: 'pcl example --ready',
    evaluate: () => true,
  }]);
  assert.equal(evaluation.ok, true);
  assert.equal(buildRequirementRefusal({
    code: 'REQUIREMENTS_UNMET',
    subject: 'Example command',
    evaluation,
  }), null);
});

test('records a throwing evaluator and continues through later requirements', () => {
  const visited = [];
  const evaluation = evaluateRequirements([
    {
      code: 'BROKEN_CHECK', field: 'broken', message: 'broken must be known', fix: 'pcl repair-check',
      evaluate: () => { visited.push('broken'); throw new TypeError('instrument unavailable'); },
    },
    {
      code: 'LATER_REQUIRED', field: 'later', message: 'later is required', fix: 'pcl example --later value',
      evaluate: () => { visited.push('later'); return false; },
    },
  ]);
  assert.deepEqual(visited, ['broken', 'later']);
  assert.deepEqual(evaluation.unmetRequirements.map((item) => item.code), ['BROKEN_CHECK', 'LATER_REQUIRED']);
  assert.deepEqual(evaluation.unmetRequirements[0].evaluationError, { name: 'TypeError', message: 'instrument unavailable' });
});
