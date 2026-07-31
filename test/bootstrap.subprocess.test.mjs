import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  diagnostic,
  errorEnvelope,
  successEnvelope,
} from './run-cli-fixture.mjs';

const childPath = fileURLToPath(new URL('./run-cli-child.mjs', import.meta.url));
const preloadPath = fileURLToPath(new URL('./stream-boundary-preload.mjs', import.meta.url));

function run(mode, extraNodeArgs = []) {
  return spawnSync(process.execPath, [...extraNodeArgs, childPath, mode], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
}

function assertExactJson(result, expected, expectedStatus) {
  assert.equal(result.status, expectedStatus, result.stderr);
  assert.equal(Buffer.byteLength(result.stdout), Buffer.byteLength(expected));
  assert.equal(result.stdout, expected);
  assert.deepEqual(JSON.parse(result.stdout), JSON.parse(expected));
}

test('finalizes stdout and stderr before a successful forced exit', () => {
  const result = run('success');
  assertExactJson(result, successEnvelope, 0);
  assert.equal(Buffer.byteLength(result.stderr), Buffer.byteLength(diagnostic));
  assert.equal(result.stderr, diagnostic);
});

test('finalizes output at the delayed stream boundary that defeats an empty write callback', () => {
  const result = run('success', ['--import', preloadPath]);
  assertExactJson(result, successEnvelope, 0);
  assert.equal(result.stderr, diagnostic);
});

test('preserves a handled Commander exit after finalization', () => {
  const result = run('commander-help');
  assertExactJson(result, successEnvelope, 0);
  assert.equal(result.stderr, diagnostic);
});

test('preserves nonzero exit code and exact JSON on an error exit', () => {
  const result = run('error-exit');
  assertExactJson(result, errorEnvelope, 7);
  assert.equal(Buffer.byteLength(result.stderr), Buffer.byteLength(diagnostic));
  assert.equal(result.stderr, diagnostic);
});

test('flushes both streams when the main promise rejects', () => {
  const result = run('rejected-main');
  assertExactJson(result, successEnvelope, 1);
  const expectedError = `${diagnostic}${JSON.stringify({ ok: false, error: 'rejected-main' })}\n`;
  assert.equal(Buffer.byteLength(result.stderr), Buffer.byteLength(expectedError));
  assert.equal(result.stderr, expectedError);
  assert.deepEqual(JSON.parse(result.stderr.slice(diagnostic.length)), {
    ok: false,
    error: 'rejected-main',
  });
});

test('escalates a concurrent uncaught exception without writing after stream end', () => {
  const result = run('uncaught-during-main');
  assertExactJson(result, successEnvelope, 1);
  const expectedError = `${diagnostic}Uncaught exception: uncaught-during-main\n`;
  assert.equal(result.stderr, expectedError);
});

test('escalates a concurrent unhandled rejection without writing after stream end', () => {
  const result = run('unhandled-during-main');
  assertExactJson(result, successEnvelope, 1);
  const expectedError = `${diagnostic}Unhandled rejection: unhandled-during-main\n`;
  assert.equal(result.stderr, expectedError);
});
