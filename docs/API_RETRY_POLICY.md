# API Retry Policy

## Scope

Rate-limit and transient-failure retries are centralised in `src/utils/retryUtils.ts` and configured in `src/constants/index.ts` (`RETRY_CONFIG`). Contract coverage lives in `src/services/__tests__/apiRateLimitRetry.test.ts` (#546).

## Eligibility

| Response / operation | Retried? |
| --- | --- |
| 429 on `GET`, `HEAD`, `OPTIONS` | Yes, up to `MAX_ATTEMPTS`. |
| 429 on `POST`, `PUT`, `DELETE` | No — non-idempotent. |
| 408 / 5xx on idempotent methods | Yes. |
| 503 on any method | Yes, unless the request is a payment/wallet operation. |
| 401 | No — owned by the auth-refresh interceptor. |
| Other 4xx | No. |
| Any request marked `paymentOperation` | Never. |

## Budget and backoff

- `MAX_ATTEMPTS` caps the number of retries; `_retryCount` increments on the same Axios config so it survives the retry chain.
- Backoff is `min(BASE_DELAY_MS * 2^attempt, MAX_DELAY_MS) + jitter(0..JITTER_MS)`.
- A `Retry-After` header (seconds or HTTP-date) takes precedence and is capped at `MAX_DELAY_MS`.
- `sleep()` performs the delay; no request or response content is used in the decision.

## Safety

Wallet and payment operations are never replayed because their outcome can be ambiguous after a transport failure. `retryLabel()` is used by the logging interceptor for diagnostics; the shared logger sanitises it before emission.
