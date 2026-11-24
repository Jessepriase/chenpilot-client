# Agent Call Cancellation

## Contract

Agent calls accept an `AbortSignal` on both paths (#543):

- non-streaming: `queryAgent(request, { signal })`
- streaming: `queryAgentStreaming(request, { signal, onDelta })`

A cancelled call **rejects with an `AbortError`**. It is never reported as a server failure and never falls back to another transport.

## Behavior

| Situation | Result |
| --- | --- |
| Signal already aborted before dispatch | No client work starts; immediate `AbortError`. |
| Abort while an HTTP/SSE request is in flight | Transport is cancelled; no success is produced from a late response. |
| Abort while stream text is pending | No further `onDelta` calls; the stream reader is cancelled in `finally`. |
| Backend lacks streaming while signal is aborted | No `/query` fallback; the `AbortError` propagates. |

`src/utils/agentCancellation.ts` is the single source of truth for `createAbortError`, `isCancellationError` (DOM `AbortError`, Axios `CanceledError`, `ERR_CANCELED`) and `assertNotAborted`, shared by streaming and non-streaming code.

## Tests

- `src/utils/agentCancellation.test.ts` — primitives.
- `src/services/__tests__/agentServiceStreaming.test.ts` — stream abort stops delivery and releases the reader.
- `src/services/__tests__/agentCancellationContract.test.ts` — non-streaming guards and fallback suppression.
