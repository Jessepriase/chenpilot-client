'use client';

import React from 'react';
import { useOptionalSocket } from '@/components/providers/SocketProvider';
import {
  getSocketDiagnostics,
  type SocketDiagnostics,
} from './socketDiagnostics';

const BADGE_BY_TONE: Record<SocketDiagnostics['tone'], string> = {
  idle: 'bg-gray-400',
  healthy: 'bg-green-500',
  pending: 'bg-yellow-500 animate-pulse',
  error: 'bg-red-500',
};

export const SocketStatusIndicator: React.FC = () => {
  const socket = useOptionalSocket();
  const diagnostics = getSocketDiagnostics(
    socket?.connectionState ?? 'idle',
    socket?.reconnectAttempt ?? 0,
    socket?.maxReconnectAttempts ?? 0,
  );

  const accessibleLabel = diagnostics.detail
    ? `${diagnostics.label}, ${diagnostics.detail}`
    : diagnostics.label;

  return (
    <div
      aria-label={`Socket status: ${accessibleLabel}`}
      className="flex items-center gap-2 text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
    >
      <span
        aria-hidden="true"
        className={`w-2.5 h-2.5 rounded-full ${BADGE_BY_TONE[diagnostics.tone]}`}
      />
      <span>{diagnostics.label}</span>
      {diagnostics.detail && (
        <span
          data-testid="socket-reconnect-attempt"
          className="tabular-nums text-gray-600 dark:text-gray-400"
        >
          {diagnostics.detail}
        </span>
      )}
    </div>
  );
};
