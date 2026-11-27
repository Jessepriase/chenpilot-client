/**
 * Shared cancellation primitives for agent calls (#543).
 *
 * Streaming and non-streaming paths must agree on what counts as a caller
 * cancellation. Without that, an abort can be reported as a server error or a
 * stream can keep emitting partial text after the caller has stopped.
 */

/** Build a consistent AbortError regardless of the runtime's DOMException support. */
export function createAbortError(message = 'The operation was aborted.'): DOMException {
  return new DOMException(message, 'AbortError');
}

/** Recognise DOM AbortError and Axios cancellation errors. */
export function isCancellationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: string };
  return (
    value.name === 'AbortError' ||
    value.name === 'CanceledError' ||
    value.code === 'ERR_CANCELED'
  );
}

/** Throw immediately when the caller has already cancelled. */
export function assertNotAborted(signal: AbortSignal | null | undefined): void {
  if (signal?.aborted) throw createAbortError();
}
