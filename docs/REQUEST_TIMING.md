# Client Request Timing Diagnostics

## Purpose

`src/utils/requestTiming.ts` records request duration by service and bounded route class (#542) so slow client experiences can be investigated without logging request or response content.

## Data model

A `RequestTimingRecord` contains only:

| Field | Value |
| --- | --- |
| `service` | Sanitized slug (max 32 chars, `[a-z0-9_-]` only). |
| `method` | Uppercased HTTP method (max 8 chars). |
| `route` | One fixed label from `REQUEST_TIMING_ROUTE_CLASSES`. |
| `durationMs` | Rounded, non-negative duration. |
| `statusClass` | `2xx`, `3xx`, `4xx`, `5xx`, or `network`. |

Concrete paths are collapsed by `routeClassFor()` before recording: identifiers, query strings, emails and tokens never enter the record. The in-memory buffer is capped at `MAX_TIMING_RECORDS` (100) and can be cleared with `resetRequestTimings()`.

## Configuration

- Outside production: recording is on by default.
- Production: recording is **off** unless `NEXT_PUBLIC_REQUEST_TIMING_ENABLED=true`.
- `NEXT_PUBLIC_REQUEST_TIMING_ENABLED=false` always disables it.

Invalid durations are ignored rather than stored as a misleading zero.

## Tests

`src/utils/requestTiming.test.ts` covers route classification, absence of private content, label sanitization, production disable/enable, invalid durations and the buffer bound.
