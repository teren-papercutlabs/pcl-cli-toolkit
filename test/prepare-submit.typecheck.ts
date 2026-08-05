import { createPrepareSubmitContract } from '../dist/index.js';

const methodStyleContract = createPrepareSubmitContract({
  id: 'typed-method.create',
  version: 1,
  subject: 'Typed method create',
  prepareCommand: 'pcl typed-method prepare',
  prefix: 'typed',
  derive(input: { value: string }, _context: Record<string, never>) {
    const prefix: string = this.prefix;
    return { value: `${prefix}:${input.value}` };
  },
  validator: () => ({ ok: true, unmetRequirements: [] }),
});

const prepared = methodStyleContract.prepare({ value: 'payload' }, {});
const typedValue: string = prepared.draft.value;
void typedValue;
