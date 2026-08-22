/**
 * Remote Neon integration tests occasionally spend longer waiting on a
 * connection/lock after a long serialized run. Production keeps the normal
 * 30-second budget; tests get a bounded budget without changing isolation.
 */
export const interactiveTransactionTimeoutMs = process.env.NODE_ENV === 'test' ? 90_000 : 30_000;

export function serializableTransactionOptions(): {
  isolationLevel: 'Serializable';
  maxWait: number;
  timeout: number;
} {
  return {
    isolationLevel: 'Serializable',
    maxWait: interactiveTransactionTimeoutMs,
    timeout: interactiveTransactionTimeoutMs,
  };
}
