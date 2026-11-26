/**
 * Structured client request timing diagnostics (#542).
 *
 * Records request duration by service and bounded route class so slow client
 * experiences can be investigated. Only numbers and fixed labels are stored:
 * no URLs with identifiers, no query strings, no request/response bodies, and
 * no auth headers. Recording is disabled in production unless explicitly
 * enabled via NEXT_PUBLIC_REQUEST_TIMING_ENABLED=true.
 */

export const REQUEST_TIMING_ROUTE_CLASSES = [
  'auth',
  'agent',
  'wallet',
  'payment',
  'contact',
  'transaction',
  'data-export',
  'other',
] as const;

export type RequestTimingRouteClass =
  (typeof REQUEST_TIMING_ROUTE_CLASSES)[number];

export type RequestTimingStatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'network';

export interface RequestTimingRecord {
  service: string;
  method: string;
  route: RequestTimingRouteClass;
  durationMs: number;
  statusClass: RequestTimingStatusClass;
}

export const MAX_TIMING_RECORDS = 100;

/**
 * Enabled by default outside production. In production it stays off unless a
 * deployment explicitly opts in, and can always be forced off with 'false'.
 */
export function isRequestTimingEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_REQUEST_TIMING_ENABLED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

/** Collapse a concrete URL into one of a small, fixed set of labels. */
export function routeClassFor(url: string): RequestTimingRouteClass {
  let path: string;
  try {
    path = new URL(url, 'https://client.invalid').pathname.toLowerCase();
  } catch {
    path = String(url).split('?')[0].toLowerCase();
  }

  if (/\/data[-/]?export/.test(path)) return 'data-export';
  if (path.includes('/query') || path.includes('/agent')) return 'agent';
  if (path.includes('/payments') || path.includes('/fund')) return 'payment';
  if (path.includes('/transactions')) return 'transaction';
  if (path.includes('/contacts')) return 'contact';
  if (path.includes('/auth') || path.includes('/account')) return 'auth';
  if (path.includes('/balance') || path.includes('/wallet')) return 'wallet';
  return 'other';
}

/** Keep service labels short and free of arbitrary user-controlled text. */
export function sanitizeServiceLabel(service: string): string {
  const cleaned = String(service).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  return cleaned || 'unknown';
}

export function statusClassFor(status?: number): RequestTimingStatusClass {
  if (typeof status !== 'number' || !Number.isFinite(status)) return 'network';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  return '2xx';
}

const records: RequestTimingRecord[] = [];

/**
 * Append a timing record. Returns the stored record, or null when recording is
 * disabled. Invalid durations are ignored rather than stored as misleading 0.
 */
export function recordRequestTiming(input: {
  service: string;
  method: string;
  url: string;
  durationMs: number;
  status?: number;
}): RequestTimingRecord | null {
  if (!isRequestTimingEnabled()) return null;
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) return null;

  const record: RequestTimingRecord = {
    service: sanitizeServiceLabel(input.service),
    method: String(input.method).toUpperCase().slice(0, 8),
    route: routeClassFor(input.url),
    durationMs: Math.round(input.durationMs),
    statusClass: statusClassFor(input.status),
  };

  records.push(record);
  if (records.length > MAX_TIMING_RECORDS) records.splice(0, records.length - MAX_TIMING_RECORDS);
  return record;
}

export function getRequestTimings(): readonly RequestTimingRecord[] {
  return records;
}

export function resetRequestTimings(): void {
  records.length = 0;
}
