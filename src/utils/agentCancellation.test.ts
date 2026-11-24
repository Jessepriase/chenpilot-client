import { describe, expect, it } from 'vitest';
import {
  assertNotAborted,
  createAbortError,
  isCancellationError,
} from './agentCancellation';

describe('agent cancellation primitives (#543)', () => {
  it('recognises DOM and Axios cancellation errors', () => {
    expect(isCancellationError(createAbortError())).toBe(true);
    expect(isCancellationError({ name: 'CanceledError' })).toBe(true);
    expect(isCancellationError({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isCancellationError(new Error('server failed'))).toBe(false);
    expect(isCancellationError(null)).toBe(false);
  });

  it('throws a consistent AbortError when the caller has already cancelled', () => {
    const controller = new AbortController();
    controller.abort();

    expect(() => assertNotAborted(controller.signal)).toThrow('aborted');
    try {
      assertNotAborted(controller.signal);
    } catch (error) {
      expect(isCancellationError(error)).toBe(true);
    }
  });

  it('does nothing for a live or missing signal', () => {
    const controller = new AbortController();
    expect(() => assertNotAborted(controller.signal)).not.toThrow();
    expect(() => assertNotAborted(undefined)).not.toThrow();
  });
});
