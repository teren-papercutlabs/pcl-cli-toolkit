import { runCli } from '../dist/index.js';
import {
  diagnostic,
  errorEnvelope,
  successEnvelope,
} from './run-cli-fixture.mjs';

const mode = process.argv[2];

runCli(async () => {
  if (mode === 'error-exit') {
    process.stdout.write(errorEnvelope);
    process.stderr.write(diagnostic);
    process.exitCode = 7;
    return;
  }

  process.stdout.write(successEnvelope);
  process.stderr.write(diagnostic);

  if (mode === 'commander-help') {
    throw { code: 'commander.helpDisplayed' };
  }

  if (mode === 'rejected-main') {
    throw new Error('rejected-main');
  }
});
