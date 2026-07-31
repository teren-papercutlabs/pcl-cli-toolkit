const stdout = process.stdout;
const originalWrite = stdout.write.bind(stdout);
const originalEnd = stdout.end.bind(stdout);
const buffered = [];

// Deterministically model the observed Node boundary: a prior write remains
// buffered while a later empty-write callback fires. The subprocess still
// sends the finalized bytes through a real captured stdout pipe. The previous
// runCli implementation exits with zero bytes here; stream finalization emits
// the exact payload.
stdout.write = ((chunk, encodingOrCallback, callback) => {
  const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined;
  const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
  const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding);

  if (bytes.length === 0) {
    done?.();
    return true;
  }

  buffered.push(bytes);
  return true;
});

stdout.end = ((chunk, encodingOrCallback, callback) => {
  const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : undefined;
  const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
  if (chunk !== undefined && chunk !== null) {
    buffered.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
  }
  for (const bytes of buffered) originalWrite(bytes);
  buffered.length = 0;
  return originalEnd(done);
});
