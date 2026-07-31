export const PAYLOAD_SIZE = 131_072;
export const STDERR_SIZE = 32_768;

export const successEnvelope = JSON.stringify({
  ok: true,
  data: { payload: 'x'.repeat(PAYLOAD_SIZE) },
});

export const errorEnvelope = JSON.stringify({
  ok: false,
  error: { code: 'EXPECTED_FAILURE', detail: 'y'.repeat(PAYLOAD_SIZE) },
});

export const diagnostic = `diagnostic:${'z'.repeat(STDERR_SIZE)}`;
