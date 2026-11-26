const STATIC_ASSET_PATHS = new Set([
  '/atomiq.jpg',
  '/chenpilot.png',
  '/favicon.ico',
  '/file.svg',
  '/globe.svg',
  '/manifest.webmanifest',
  '/next.svg',
  '/starknet.jpg',
  '/troves.jpg',
  '/vercel.svg',
  '/vesu.jpg',
  '/window.svg',
  '/xverse.jpg',
]);

export const BUILD_ASSET_PREFIX = '/_next/static/';

// One list drives both the denial regex and the user-facing guidance, so the
// /offline page can never advertise a resource the service worker refuses to
// cache (#553). `pattern` is a regex fragment; `label` is plain-language copy.
const SENSITIVE_PATH_PATTERNS = [
  { pattern: 'auth', label: 'sign-in and authentication pages' },
  { pattern: 'protected', label: 'protected pages' },
  { pattern: 'account', label: 'account settings' },
  { pattern: 'wallet', label: 'wallet details' },
  { pattern: 'balance', label: 'balances' },
  { pattern: 'contacts?', label: 'contacts' },
  { pattern: 'transactions?', label: 'transactions' },
];

const SENSITIVE_PATH = new RegExp(
  `/(?:${SENSITIVE_PATH_PATTERNS.map(({ pattern }) => pattern).join('|')})(?:/|$)`,
  'i',
);

/**
 * The exact allowlist used by the service worker, expressed for the offline
 * guidance route (#553). Returned as fresh arrays so callers cannot mutate the
 * policy used by the worker.
 */
export function getCacheAllowlistSummary() {
  return {
    buildAssetPrefix: BUILD_ASSET_PREFIX,
    publicFiles: Array.from(STATIC_ASSET_PATHS),
    sensitiveDataLabels: SENSITIVE_PATH_PATTERNS.map(({ label }) => label),
  };
}

export function isCacheablePublicResource(requestUrl, method, appOrigin) {
  if (method.toUpperCase() !== 'GET') return false;

  let url;
  try {
    url = new URL(requestUrl, appOrigin);
  } catch {
    return false;
  }

  if (url.origin !== appOrigin || SENSITIVE_PATH.test(url.pathname)) {
    return false;
  }

  return (
    url.pathname.startsWith(BUILD_ASSET_PREFIX) ||
    STATIC_ASSET_PATHS.has(url.pathname)
  );
}
