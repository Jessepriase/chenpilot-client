import type { Metadata } from 'next';
import { OfflineGuidance } from '@/components/offline/OfflineGuidance';
import { getSafeRetryPath } from '@/components/offline/offlineGuidanceCopy';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'What remains available in ChenPilot while you are offline.',
};

type OfflinePageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

/**
 * Guidance for protected pages that cannot load without a connection (#553).
 * The retry target is validated here so the client never receives an external
 * or protocol-relative URL.
 */
export default async function OfflinePage({ searchParams }: OfflinePageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  return <OfflineGuidance next={getSafeRetryPath(rawNext)} />;
}
